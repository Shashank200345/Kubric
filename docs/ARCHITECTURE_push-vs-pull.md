# Architecture Note: Push vs Pull, and the Read-Path Migration

Status: Draft for decision
Scope: Explains why Kubric must be push-based, documents the current pull-based
read/scan paths, and proposes a migration so a connected cluster actually shows
data in production. This note is a prerequisite for the user-onboarding spec.

---

## 1. Why push (the security decision)

Kubric connects to customer Kubernetes clusters. There are two ways to get data:

- **Pull**: the Kubric backend reaches into each customer cluster's API server and
  runs `kubectl`. Requires network reachability to the control plane and stored
  cluster credentials.
- **Push**: an agent runs *inside* the customer cluster, collects data with scoped
  RBAC, and sends it outbound over HTTPS to the Kubric backend. The backend never
  contacts the customer's API server.

Push is the required production model for these reasons:

1. **No inbound access to the customer control plane.** Customers will not expose
   their kube-apiserver to the internet or to our SaaS.
2. **No central credential store.** Pull would require storing customer
   kubeconfigs / service-account tokens centrally — a single breach would grant an
   attacker access to every customer cluster. Push keeps credentials in-cluster.
3. **Least privilege + tenant isolation.** Each agent has its own scoped RBAC and a
   per-cluster token. A leaked token affects one cluster, not all. Remediation runs
   with the agent's in-cluster identity, not a shared super-admin credential.
4. **Egress-only networking.** Outbound HTTPS is firewall-friendly and is how every
   production agent (Datadog, New Relic, Grafana Agent, etc.) operates.

---

## 2. What is push today, and what is still pull

### Already push (correct)
- Incident ingestion: agent → `POST /api/v1/ingest` (auth via `cluster_token`,
  validated by `validate_cluster_token`). Creates an investigation and runs AI
  reasoning in the background.
- Remediation execution: agent polls `GET /api/v1/actions/pending`, executes the
  approved action in-cluster, and reports via `POST /api/v1/actions/{id}/result`.

### Still pull (the gap)
The backend runs `kubectl` directly against its own kubeconfig via
`KubectlExecutor`. These paths only work when the backend has local access to the
cluster (true in local dev with minikube/kind, false for a real remote customer):
- `GET /clusters` — `kubectl config get-contexts`
- `GET /workloads`, `GET /pods`, `GET /nodes`, `GET /metrics`, `GET /events`
- `POST /investigate` — the whole scan pipeline (`InvestigationService` →
  Pod/Logs/Events/Deployment/Network inspectors) shells out to `kubectl`
- `POST /api/v1/actions` — currently executes the fix from the backend via
  `_execute_action_locally` (local `kubectl`) instead of dispatching to the agent

### Consequence for onboarding
A production user who installs **only the agent** connects successfully but then
sees **empty Workloads / Nodes / Troubleshoot** screens and cannot run a scan,
because those endpoints expect local `kubectl` access the backend does not have for
a remote cluster. Local dev hides this because the backend's kubeconfig contains the
test clusters.

---

## 3. The three questions this note must answer

### Q1 — How does agent-pushed cluster state get stored and served?

**Proposal:** the in-cluster agent periodically (e.g. every 15–30s) collects a
cluster snapshot and pushes it to a new endpoint. The backend stores the latest
snapshot per cluster; dashboard read endpoints serve from storage instead of
`kubectl`.

- New endpoint: `POST /api/v1/state` (auth: `cluster_token`)
  - Body: `{ pods[], nodes[], workloads[], metrics{}, events[], collected_at }`
  - Backend upserts into per-cluster state tables (or a single `cluster_state`
    JSON row keyed by `cluster_name` + `user_id`).
- Read endpoints (`/workloads`, `/pods`, `/nodes`, `/metrics`, `/events`) change
  from "run kubectl" to "read latest pushed snapshot for this user's selected
  cluster", filtered by the authenticated user (RLS on `user_id`).
- `/clusters` changes from "read kubeconfig contexts" to "list clusters the user
  has registered" (the `clusters` table already exists and is used by
  `validate_cluster_token`).
- Freshness: store `collected_at`; the UI shows "synced Ns ago" and a stale badge
  if the agent has not reported within a threshold.

### Q2 — How does `/investigate` (the scan) work without backend kubectl?

The scan's inspectors currently run in the backend against local `kubectl`. In
push, the **agent** must run the inspection and push the evidence.

**Proposal:** on-demand investigation becomes a request/response through the agent:
- User clicks Scan → `POST /investigate` creates an investigation row (status
  `pending`) and records a "scan requested" job for that cluster.
- The agent (already polling for actions) also polls for scan requests, runs the
  same inspector logic in-cluster, and pushes evidence to
  `POST /api/v1/investigate/{id}/evidence`.
- Backend runs AI reasoning on the pushed evidence (reusing `KubernetesAIAgent`)
  and completes the investigation. The existing realtime + progress mechanism
  already supports surfacing this to the UI.
- The inspector code (`app/kubernetes/inspectors/*`) is shared logic that should
  move into the agent binary; the backend keeps only AI reasoning + persistence.

This also naturally fixes remediation: `POST /api/v1/actions` should stop calling
`_execute_action_locally` in production and instead queue the action for the agent
to pull and execute (the pull/report endpoints already exist).

### Q3 — Migration path that keeps local dev working

We do not want to break the fast local-dev loop (backend + minikube in kubeconfig).

**Proposal:** introduce a data-source switch, e.g. `KUBRIC_DATA_SOURCE=local|agent`
(env var, default `local` for dev, `agent` in production):
- `local`: endpoints behave exactly as today (backend `kubectl`). Zero change to
  the current developer experience.
- `agent`: endpoints read pushed snapshots / dispatch scans and actions to the
  agent.
- A thin service interface (`ClusterDataSource`) with two implementations
  (`LocalKubectlSource`, `AgentPushSource`) keeps the endpoints unaware of which
  mode is active.

Rollout order:
1. Add `cluster_state` storage + `POST /api/v1/state`; agent starts pushing state.
2. Introduce `ClusterDataSource` interface; wrap current kubectl logic as
   `LocalKubectlSource`; add `AgentPushSource` reading from storage.
3. Gate read endpoints on `KUBRIC_DATA_SOURCE`.
4. Move inspector logic into the agent; switch `/investigate` and `/api/v1/actions`
   to agent dispatch in `agent` mode.
5. Flip production to `agent`; keep `local` for dev/CI.

---

## 4. Decision needed before onboarding spec is finalized

- [ ] Approve push as the sole production data path (read + scan + remediate).
- [ ] Approve the `cluster_state` snapshot approach for read endpoints (Q1).
- [ ] Approve agent-run inspection for scans (Q2).
- [ ] Approve the `KUBRIC_DATA_SOURCE` dev/prod switch for migration (Q3).

Once decided, the onboarding spec can state truthfully: "after the agent reports in
(within ~30s of Helm install), Overview/Workloads/Nodes populate and the user can
run their first scan." Until then, onboarding requirements should treat the read
path as a documented assumption dependent on this migration.

---

## 4a. Implementation status (backend foundation — done)

Implemented now (additive, `local` remains the default so dev is unchanged):

- **DB:** `frontend/migrations/20260721_create_cluster_state.sql` — `cluster_state`
  table (per user+cluster snapshot of pods/nodes/workloads/events/metrics) with RLS.
  *Must be applied to InsForge before agent mode works.*
- **Storage client:** `InsForgeClient.upsert_cluster_state`, `get_cluster_state`,
  `list_state_clusters`.
- **Ingest endpoint:** `POST /api/v1/state` (auth via `cluster_token`) — the agent
  posts a full snapshot; backend upserts it.
- **Data-source switch:** `KUBRIC_DATA_SOURCE=local|agent` (default `local`).
  Read endpoints `/clusters`, `/metrics`, `/workloads`, `/pods`, `/nodes`, `/events`
  serve from the stored snapshot when `agent`, else fall through to local `kubectl`.

Implemented in the second pass (agent is Python — testable):

- **Agent collector (item 1):** `agent/collector.py` (`StateCollector`) builds a full
  snapshot (pods, nodes, workloads, events, metrics) matching the backend's response
  shapes; `agent/main.py` calls `_push_state_once()` each poll cycle → `POST /api/v1/state`.
- **Scan over agent (Q2, collapsed):** in `agent` mode, `POST /investigate` builds
  evidence from the latest snapshot via `_evidence_from_state()` and runs the existing
  `KubernetesAIAgent.analyze()` — no duplicate inspector pipeline. (Local mode still
  uses the live `InvestigationService`.)
- **Action dispatch (item 3):** in `agent` mode, `POST /api/v1/actions` leaves the
  action `pending` for the in-cluster agent to pull and execute (its
  `_fetch_and_execute_actions` loop already does this). Local mode still executes
  directly via `_execute_action_locally`.
- **Auth scoping (item 4):** read endpoints now accept an optional `Authorization`
  header and scope `cluster_state` reads by `user_id` when a JWT is present.

Remaining before production:

- **Snapshot logs:** the collector does not yet include per-pod logs for unhealthy
  pods, so agent-mode diagnosis reasons over status + events only. Add a `logs`
  section for richer root-cause quality.
- **Frontend token on reads + enforcement flip:** the dashboard read fetches
  (`/workloads`, `/pods`, `/nodes`, `/metrics`, `/events`, `/clusters`) should send
  the user JWT, and the backend should then *require* it in `agent` mode (reject
  unauthenticated) so tenants can't collide on a shared `cluster_name`. Backend
  support exists; the enforcement flip is the last step.
- Cannot run the agent end-to-end here (no live cluster); validated by parse only.

## 5. Out of scope for this note
- UI/UX of the onboarding wizard (covered by the onboarding spec).
- Billing, quotas, multi-cluster switching UX.
- The exact snapshot schema and retention policy (design doc detail).
