# Kubric — Project Context for Claude Code

> This file is auto-loaded by Claude Code at the start of every session in this
> repo. It captures architecture decisions, hard-won bug fixes, and guardrails
> established over the course of this project — read this before making
> changes, especially anything touching the agent, auto-fix, or AI prompts.

---

## What Kubric Is

An AI-powered Kubernetes platform with two halves, built in this order:

1. **Post-deployment detection & remediation** (built first, mostly working) — an in-cluster agent detects real incidents (CrashLoopBackOff, OOMKilled, ImagePullBackOff), an AI diagnoses root cause with cited evidence, and an approved fix executes via a small set of safe, structured actions.
2. **Pre-deployment risk assessment** (not yet built — this is the actual differentiator) — a GitHub App that reads a PR's diff, cross-references it against the target service's real resource-usage history, and comments on the PR before merge with a risk assessment. **Nobody else in this market does this combination.** Everything built so far is valuable, but it is the "catch up to Komodor/Datadog" half of the product, not the differentiated half.

**Do not describe Kubric as having capabilities it doesn't have.** Specifically excluded, on purpose, unless this file is updated to say otherwise: network/connectivity tracing (CNI, CoreDNS, ingress hop tracing), scheduler placement reasoning (taints, affinity, noisy-neighbor suggestions), any performance metric that hasn't actually been measured from real usage (no invented MTTD/MTTR numbers — a real ~60% MTTD claim was fabricated earlier in this project and had to be retracted; never repeat that pattern).

---

## Architecture

```
Customer Cluster                          Backend (FastAPI)
─────────────────                         ──────────────────────
In-cluster Python agent  ──POST──▶  /api/v1/ingest  ──▶  investigations table
  (native k8s SDK,                                        (InsForge / Postgres)
   NOT kubectl subprocess)                                      │
                                                                  ▼
                                                          BackgroundTask → LLM
                                                          (OpenRouter) → writes
                                                          root_cause, fix,
                                                          evidence_used,
                                                          suggested_action

Frontend (Next.js)  ──POST /api/v1/actions──▶  actions table ──▶ agent polls
                                                                  ──▶ executes
                                                                  (structured
                                                                   actions only)
```

**This is a push-based architecture. The backend never reaches into a customer's cluster.** It was originally built pull-based (backend ran `kubectl` directly against the cluster) purely to get something running quickly during local development — that was fine for local testing but was explicitly not the production design, since it would require a real customer to expose their Kubernetes API server externally. It has since been migrated to push-based (agent inside the cluster sends data out). Do not reintroduce pull-based patterns.

**Stack:** Python/FastAPI backend, Next.js frontend, InsForge (Postgres + PostgREST + realtime, Supabase-like BaaS), OpenRouter for LLM access, native `kubernetes` Python SDK in the agent (not `subprocess`/`kubectl` shell-outs), minikube for local dev (not kind).

---

## Critical Guardrails — Do Not Violate These

### 1. The AI diagnosis prompt must cite specific evidence, never generic advice
Established after finding the AI was producing boilerplate ("check your start command") because the pod inspector was stripping `command`, `args`, `image`, `exitCode`, and `restartCount` before the AI ever saw them. Fixed by (a) sending the full container spec fields, and (b) a system prompt that mandates citing the specific field that proves the conclusion, forbids restating the symptom as the cause (e.g. "CrashLoopBackOff because the container keeps restarting" is circular and forbidden), and explicitly permits saying evidence is insufficient rather than inventing plausible-sounding specifics. See `docs/kubric-auto-fix-v2-redesign.md` Section 8 for the full prompt. **Never weaken this prompt to make outputs sound more confident — an honest "insufficient evidence" is a correct, expected output, not a failure.**

### 2. Crash detection must check CURRENT state, never restart history
A real bug: checking `lastState.terminated.reason` (or `restartCount`) instead of `state.waiting.reason`/`state.terminated.reason` caused every pod with old restart history — even from days ago, even fully healthy now — to be flagged as an active incident. Fixed by checking current container state first; only consult `lastState` to classify *why* a pod that is *currently* failing failed. Any new detection logic must follow this same pattern.

### 3. Auto-fix actions are structured and allow-listed — never raw shell/kubectl text
A real security vulnerability was caught and redesigned: the original approach let the AI generate free-text shell commands, filtered only by a string blocklist (`"rm -rf"`, `"wget "`, etc.), executed via `subprocess.run(["sh", "-c", command])`. Blocklists are trivially bypassable, and free-text LLM-generated commands combined with a prompt-injectable evidence pipeline is a real RCE risk. **The fix: the AI selects from exactly four pre-defined, parameterized actions** (`restart_pod`, `rollback_deployment`, `update_resource_limits`, `scale_deployment`), each implemented as a specific native Kubernetes SDK call — never a shell subprocess. Full spec, RBAC scoping, and DB schema in `docs/kubric-auto-fix-v2-redesign.md`. **Do not add a fifth action, and do not reintroduce any code path that executes free-text commands, without deliberately revisiting this decision.**

### 4. RBAC ClusterRoleBinding cannot exclude namespaces — the backend must
A `ClusterRoleBinding` grants permissions cluster-wide with no way to exclude `kube-system`/`kube-public`/`kubric-system` at the RBAC layer. The namespace exclusion is enforced in application code instead — `POST /api/v1/actions` must reject any action whose `namespace` param is in a protected-namespace blocklist, before the row is ever inserted. This is the one and only place this protection exists — do not assume RBAC is handling it.

### 5. Backend-initiated database writes need the right auth context, not the user's
When the backend (not the browser) is the one writing to InsForge (e.g. inserting into `actions`), it needs to authenticate with a service-role-equivalent credential — using a stale or absent user JWT against a table with `auth.uid() = user_id`-style RLS policies will silently fail the insert with the actual constraint violation buried in the response body, not the generic error the client sees. When debugging any "insert failed" issue, always get the actual PostgREST response body (`e.response.text` on the `httpx.HTTPStatusError`), never trust the generic `str(e)` wrapper — it hides the real reason every time.

### 6. Verify claims with a real test — don't accept "it works" from output that merely looks right
This project has repeatedly found real bugs hiding behind output that looked correct at a glance: a stale cached Docker image silently serving old code after a "fix," a liveness probe that passed for a whole minute but was never actually tested against a real failure, an "evidence_used" claim that turned out to be from a completely different (and more interesting) incident than the one being tested. Before calling anything "verified" or "rock solid," construct the specific test that would fail if the fix didn't actually work — not just re-run the happy path.

---

## Current State (update this section as things change)

**Built and verified:**
- Push-based in-cluster agent, native k8s SDK, no shell-outs
- Crash detection (CrashLoopBackOff, OOMKilled, ImagePullBackOff) checking current state correctly
- Evidence-grounded AI diagnosis, verified across three distinct failure types (bad command, bad image, missing binary in a probe) — each correctly cited the specific evidence, not generic advice
- `evidence_used` persisted to the database as a queryable JSONB column
- Liveness probe using a heartbeat-file pattern (not `pgrep`, which isn't in the slim agent image) — verified to survive its own cold start AND to actually trigger a restart under a deliberate forced-failure test
- Web dashboard — real, working
- CLI — scoped intentionally to just `kubric connect` (installs the agent, prints a status summary at the end as its final step; no standalone `status` command, no `ask`/`diagnose`/`review`/`fix` commands yet — those are Phase 3, see `docs/kubric-cli-spec.md`)

**In progress / currently broken:**
- Auto-fix "Approve Fix" flow — redesigned to the structured-action model (`docs/kubric-auto-fix-v2-redesign.md`), but the actual `POST /api/v1/actions` → InsForge insert is currently failing with a `400 Bad Request`. Root cause not yet confirmed — actively debugging by reading the raw PostgREST response body (see Guardrail 5). Do not assume this is fixed until the actual response body has been read and the fix confirmed against a real re-test.

**Not started yet:**
- The entire pre-deployment PR risk assessment path (GitHub App, diff parser, resource-usage history table, risk-assessment prompt, PR comment posting) — this is the actual product differentiator and the next major body of work after auto-fix is unblocked
- Cloud deployment (backend and frontend currently run locally only)
- Billing/subscriptions (correctly deferred — not needed for beta)
- User-facing cluster token generation UI (currently manual via SQL)

---

## Detailed Specs (in `/docs`)

Read the relevant one before working in that area — each was written after real design discussion and, in several cases, real bugs found during implementation:

- `docs/kubric-ui-spec.md` — full design system and screen-by-screen UI spec for the web platform
- `docs/kubric-cli-spec.md` — the full 9-command CLI vision (Phase 3 — not current scope)
- `docs/kubric-cli-v0-build-guide.md` — the actual current CLI scope: just `connect`
- `docs/kubric-placeholder-chart-guide.md` — the placeholder Helm chart used before the real agent existed; now superseded by the real agent, kept for reference on the values.yaml contract (`clusterToken`, `ingestionEndpoint`, `clusterName`, `image`) that should stay stable
- `docs/kubric-e2e-test-pull-based.md` — the local pull-based test procedure, explicitly superseded now that push-based is live; kept because the `incidents` table schema and dashboard wiring it validated are still in use
- `docs/kubric-auto-fix-v2-redesign.md` — the full structured-action auto-fix design: schema, RBAC, prompt changes, and the debugging checklist for realtime/RLS issues

---

## Working Style for This Project

- Prefer fixing the actual root cause over patching symptoms — this project has repeatedly found that the first plausible-looking explanation for a bug was wrong (stale image cache, wrong error being read, RLS vs payload-shape confusion)
- When something claims to be "done" or "verified," ask what specific test proves it, and whether that test would actually fail if the thing were broken
- Keep scope narrow and deliberate — this project has a history of scope creep (a 9-command CLI shrunk to 1, feature grids with invented capabilities cut back to what's real) and a documented discipline of only building what's actually needed for the current phase
- Never state a specific performance number (MTTD, MTTR, %, etc.) unless it was actually measured from real usage — mark anything else explicitly as a target or projection
