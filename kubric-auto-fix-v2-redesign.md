# Kubric Auto-Fix Pipeline — Production-Ready Redesign

> Replaces raw shell/kubectl command execution with a fixed set of safe,
> parameterized, allow-listed actions. The AI never generates free-text
> commands — it selects from a small registry of pre-vetted operations,
> each implemented with the native Kubernetes Python SDK, never a shell
> subprocess. This closes the prompt-injection-to-RCE path that existed
> in the previous design.

---

## Table of Contents

1. [Why the Redesign Is Necessary](#1-why-the-redesign-is-necessary)
2. [The Action Registry — What's Actually Allowed](#2-the-action-registry--whats-actually-allowed)
3. [Database Schema](#3-database-schema)
4. [Backend Implementation](#4-backend-implementation)
5. [Agent Implementation](#5-agent-implementation)
6. [Frontend Implementation](#6-frontend-implementation)
7. [RBAC — Scoping the Agent's Permissions](#7-rbac--scoping-the-agents-permissions)
8. [AI Prompt Update — Structured Action Output](#8-ai-prompt-update--structured-action-output)
9. [Debugging Checklist — Why Results Aren't Reaching the UI Right Now](#9-debugging-checklist--why-results-arent-reaching-the-ui-right-now)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Why the Redesign Is Necessary

The previous design let the AI generate a raw shell command as free text, filtered only by a string blocklist (`"rm -rf"`, `"wget "`, `"curl "`), then executed it via `subprocess.run(["sh", "-c", command_str], ...)`.

Two compounding problems:

**Blocklists are trivially bypassed.** `rm -fr`, `find / -delete`, base64-encoded payloads, or dozens of other equivalent constructions all sail past a substring check. A blocklist can only ever cover the specific bad patterns someone thought of in advance.

**The execution primitive itself is unbounded.** `sh -c` can run anything — not just Kubernetes operations, any shell command at all, with whatever privileges the agent's process and filesystem access allow. Combined with an LLM that reads pod names, labels, and log content as evidence, there's a real path where manipulated cluster content could influence what the AI proposes as a "fix" — and if that fix is raw shell text, an approved fix could execute arbitrary code inside the customer's cluster.

**The fix is not a better blocklist — it's removing the unbounded execution primitive entirely.** The AI selects from a small, fixed menu of specific operations. Even in the worst case, a manipulated AI output can only ever trigger one of these pre-vetted, narrowly-scoped Kubernetes API calls — there's no shell, no arbitrary code path, for it to reach.

---

## 2. The Action Registry — What's Actually Allowed

Exactly four actions exist for v1. Each maps to one specific Kubernetes API call using the native Python SDK.

| `action_type` | Parameters | What it does |
|---|---|---|
| `restart_pod` | `namespace`, `pod_name` | Deletes the pod (its owning Deployment/ReplicaSet recreates it) |
| `rollback_deployment` | `namespace`, `deployment_name`, `target_revision` (optional) | Rolls back to the previous revision, or a specific one if given |
| `update_resource_limits` | `namespace`, `deployment_name`, `container_name`, `memory_limit` (optional), `cpu_limit` (optional) | Patches the container's resource limits |
| `scale_deployment` | `namespace`, `deployment_name`, `replicas` | Patches the replica count |

**This list is deliberately short.** Adding a fifth action later is a real, reviewable code change — not a prompt tweak. That's the point: the attack surface is exactly as large as this table, and nothing else.

---

## 3. Database Schema

```sql
-- Replaces the previous `commands` table design.
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,

  action_type TEXT NOT NULL CHECK (
    action_type IN ('restart_pod', 'rollback_deployment', 'update_resource_limits', 'scale_deployment')
  ),
  params JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'success', 'failed')
  ),
  output JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- Users can only see/insert actions tied to their own user_id
CREATE POLICY "actions_select_own" ON public.actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "actions_insert_own" ON public.actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Two things worth noting:**

The `action_type` CHECK constraint enforces the allow-list *at the database level*, not just in application code — even a bug in the backend's validation logic can't insert an action type outside this list, because the database itself will reject it.

The `in_progress` status (missing from the original design) matters for correctness — see Section 9's note on idempotency. Without it, a slow-running action and a retry attempt can race.

---

## 4. Backend Implementation

**Master prompt — hand this to your AI coding tool:**

```
In my FastAPI backend, add the following, replacing the old free-text
commands approach:

1. Define a Pydantic model for each of the four allowed actions, each
   with strict typing:

   class RestartPodParams(BaseModel):
       namespace: str
       pod_name: str

   class RollbackDeploymentParams(BaseModel):
       namespace: str
       deployment_name: str
       target_revision: Optional[int] = None

   class UpdateResourceLimitsParams(BaseModel):
       namespace: str
       deployment_name: str
       container_name: str
       memory_limit: Optional[str] = None
       cpu_limit: Optional[str] = None

   class ScaleDeploymentParams(BaseModel):
       namespace: str
       deployment_name: str
       replicas: int = Field(ge=0, le=50)  # sane upper bound, reject anything absurd

2. Add POST /api/v1/actions — this is the ONLY way an action gets
   created. The frontend must call this endpoint; it must never insert
   directly into the actions table.

   Request body:
     { "investigation_id": "...", "action_type": "update_resource_limits",
       "params": { ... } }

   Behavior:
   - Require authentication (existing auth dependency)
   - Validate action_type is one of the four allowed strings — reject
     with 400 if not
   - Validate params against the matching Pydantic model for that
     action_type — reject with 422 if params don't match (e.g. replicas
     is negative, or a required field is missing)
   - Look up investigation_id, confirm it belongs to the authenticated
     user, and derive cluster_name from it — never trust a cluster_name
     passed directly from the client
   - Insert the row with status='pending'
   - Return the created row

3. Add GET /api/v1/actions/pending — used by the agent to poll.
   - Authenticate via Bearer <CLUSTER_TOKEN>, same pattern as the
     existing ingest endpoint
   - Resolve cluster_name from the token via the clusters table
   - Return all rows where status='pending' for that cluster_name
   - Immediately after fetching, update those rows to status='in_progress'
     in the same request, so a second poll cycle (or a retry) can't pick
     up and execute the same action twice. Return the pre-update rows to
     the caller.

4. Add POST /api/v1/actions/{action_id}/result
   - Authenticate via the same CLUSTER_TOKEN
   - Verify the action_id belongs to a cluster matching this token —
     reject if not, don't allow one cluster's agent to update another
     cluster's action
   - Only allow this to patch rows currently in status='in_progress' —
     reject (409) if the row is already 'success' or 'failed', to avoid
     double-reporting
   - Body: { "status": "success" | "failed", "output": { ... } }
   - Patch the row's status, output, and updated_at

Do not implement any endpoint that accepts a raw command string. If any
old /api/v1/commands/* routes exist, remove them entirely rather than
leaving them reachable alongside the new ones.
```

---

## 5. Agent Implementation

**Master prompt:**

```
In agent/main.py, replace the previous _fetch_and_execute_commands
function entirely with a new _fetch_and_execute_actions function. This
version never shells out — every action is implemented as a specific
call using the kubernetes Python client library (the same one already
used elsewhere in this agent for inspection).

1. Poll GET /api/v1/actions/pending every 15 seconds, same interval and
   auth pattern as the existing ingestion polling loop.

2. For each returned action, dispatch based on action_type using a
   plain if/elif chain or a dict-based registry — NOT dynamic code
   execution, NOT eval, NOT exec, NOT importlib based on a string from
   the payload. Something like:

   ACTION_HANDLERS = {
       "restart_pod": handle_restart_pod,
       "rollback_deployment": handle_rollback_deployment,
       "update_resource_limits": handle_update_resource_limits,
       "scale_deployment": handle_scale_deployment,
   }

   handler = ACTION_HANDLERS.get(action["action_type"])
   if handler is None:
       # Should never happen given the DB constraint, but defend anyway
       report_failure(action["id"], "Unknown action_type — rejected by agent")
       continue

3. Implement each handler using kubernetes.client, not subprocess:

   def handle_restart_pod(params, core_v1_api):
       core_v1_api.delete_namespaced_pod(
           name=params["pod_name"], namespace=params["namespace"]
       )
       return {"message": f"Deleted pod {params['pod_name']}, owning controller will recreate it"}

   def handle_rollback_deployment(params, apps_v1_api):
       # Use the Kubernetes rollback mechanism — patch to a prior
       # ReplicaSet's pod template, or use the equivalent of
       # `kubectl rollout undo` via the API (fetch ReplicaSets owned by
       # the deployment, find the target revision's template, patch it in)
       ...

   def handle_update_resource_limits(params, apps_v1_api):
       # Build a strategic merge patch touching ONLY the specific
       # container's resources.limits fields — never replace the whole
       # deployment spec
       patch = {
           "spec": {"template": {"spec": {"containers": [
               {"name": params["container_name"],
                "resources": {"limits": {
                    k: v for k, v in {
                        "memory": params.get("memory_limit"),
                        "cpu": params.get("cpu_limit"),
                    }.items() if v is not None
                }}}
           ]}}}
       }
       apps_v1_api.patch_namespaced_deployment(
           name=params["deployment_name"], namespace=params["namespace"], body=patch
       )
       return {"message": f"Updated resource limits for {params['container_name']}"}

   def handle_scale_deployment(params, apps_v1_api):
       apps_v1_api.patch_namespaced_deployment_scale(
           name=params["deployment_name"], namespace=params["namespace"],
           body={"spec": {"replicas": params["replicas"]}}
       )
       return {"message": f"Scaled {params['deployment_name']} to {params['replicas']} replicas"}

4. Wrap every handler call in try/except. On success, POST
   {"status": "success", "output": <the returned dict>} to
   /api/v1/actions/{id}/result. On any exception, POST
   {"status": "failed", "output": {"error": str(exception)}} — never
   let an exception crash the polling loop itself; catch, report, and
   continue to the next action.

5. Add a hard timeout around each Kubernetes API call (the client
   library supports a _request_timeout parameter) so a hung API call
   can't block the polling loop indefinitely.

Remove subprocess and sh entirely from this file's action-execution
path — the only remaining subprocess usage anywhere in the agent
should be unrelated to command/action execution, if any exists at all.
```

---

## 6. Frontend Implementation

**Master prompt:**

```
In frontend/src/app/dashboard/page.tsx, replace the direct database
insert with a call to the new backend endpoint.

Before:
  await insforge.database.from('commands').insert([{ ... }])

After:
  1. When an investigation completes and its structured output contains
     a suggested_action field (see Section 8 for the AI prompt change
     that produces this), render the action_type and params in a clear,
     human-readable summary BEFORE showing the approve button — e.g.
     "Kubric wants to: update memory limit for payment-service to
     512Mi in namespace default." Never show a bare "Approve & Run"
     button without first showing exactly what will happen.

  2. On approval click, call:
     const res = await fetch('/api/v1/actions', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
       body: JSON.stringify({
         investigation_id: currentInvestigation.id,
         action_type: currentInvestigation.suggested_action.action_type,
         params: currentInvestigation.suggested_action.params,
       }),
     });
     Handle non-2xx responses by showing the validation error to the
     user (e.g. if params failed Pydantic validation) rather than
     failing silently.

  3. Keep the realtime subscription, but point it at the new `actions`
     table instead of `commands`:
     insforge.realtime.subscribe('actions:all', ...)
     Update the status-handling logic to also handle the new
     'in_progress' status — show a distinct "running..." state in the
     UI between "pending" and the final "success"/"failed", so the user
     gets feedback the moment the agent picks up the action, not just
     when it finishes.

Do not leave any code path that inserts directly into a database table
from the frontend for this feature — every action creation must go
through the backend endpoint so server-side validation always runs.
```

---

## 7. RBAC — Scoping the Agent's Permissions

The agent's ServiceAccount needs exactly enough permission to perform the four actions above — nothing broader.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubric-agent-actions
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["delete"]          # for restart_pod
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "patch"]    # for update_resource_limits, scale_deployment, rollback
  - apiGroups: ["apps"]
    resources: ["deployments/scale"]
    verbs: ["patch"]           # for scale_deployment specifically
  - apiGroups: ["apps"]
    resources: ["replicasets"]
    verbs: ["get", "list"]     # needed to find prior revisions for rollback
```

**Deliberately absent:** no `create` or `delete` on Deployments themselves, no access to Secrets, no `exec` into pods, no access to ConfigMaps, no cluster-admin-equivalent verbs anywhere. If a fifth action is added later that needs a new permission, that's a visible, reviewable RBAC change — not something that silently already had access it didn't need.

---

## 8. AI Prompt Update — Structured Action Output

Extend the existing diagnosis prompt (the one already enforcing evidence citation) to also produce a structured, machine-usable action alongside the human-readable fix text:

```python
# Addition to the existing SYSTEM_PROMPT from prompts.py

ACTION_SCHEMA_ADDITION = """
In addition to root_cause, fix, and evidence_used, you must also
propose a suggested_action, chosen ONLY from this exact list — do not
invent an action_type outside this set:

  - restart_pod: { "namespace": str, "pod_name": str }
  - rollback_deployment: { "namespace": str, "deployment_name": str, "target_revision": int or null }
  - update_resource_limits: { "namespace": str, "deployment_name": str, "container_name": str, "memory_limit": str or null, "cpu_limit": str or null }
  - scale_deployment: { "namespace": str, "deployment_name": str, "replicas": int }

If none of these four actions genuinely address the root cause you
identified, set suggested_action to null rather than forcing a fit —
an honest "no safe automated action available" is correct and expected
for many incidents (e.g. an application logic bug found in logs has no
safe automated fix from this list).

Output shape now includes:
{
  "root_cause": "...",
  "fix": "...",
  "evidence_used": [...],
  "suggested_action": {
    "action_type": "update_resource_limits",
    "params": { "namespace": "default", "deployment_name": "payment-service",
                "container_name": "payment-service", "memory_limit": "512Mi", "cpu_limit": null }
  }  // or null
}
"""
```

**Why `suggested_action` can be `null`:** forcing the model to always propose one of the four actions, even when none genuinely fits, would recreate the exact "generic advice dressed up as specific" problem already found and fixed once in this project. An honest "no safe automated fix available for this" is a correct output, not a failure.

---

## 9. Debugging Checklist — Why Results Aren't Reaching the UI Right Now

Given "commands run but results never show up in the UI," work through these in order — each one rules something specific in or out.

**1. Confirm the agent's result POST actually succeeds.**
Check the agent's own logs right after it executes something. Is there a log line confirming a `200`/`204` response from `POST /api/v1/actions/{id}/result` (or the old `/commands/.../result` route)? If the agent is silently swallowing a failed POST (wrong URL, expired token, network error) without logging it, this would look exactly like "ran but never showed up."

**2. Confirm the backend actually received and applied the patch.**
Check backend logs for the same request. If it never arrives, the problem is entirely on the agent's network path — check the agent's configured backend URL again (the same class of `host.docker.internal` vs `host.minikube.internal` issue from earlier in this project is worth ruling out here too, if this is being tested locally).

**3. Query the database directly, bypassing the UI entirely.**
```sql
SELECT id, status, output, updated_at FROM public.commands ORDER BY updated_at DESC LIMIT 5;
```
If the row shows `status = 'success'` with real `output`, the backend and agent are working correctly, and the bug is entirely in the realtime delivery or frontend subscription — skip to step 5. If the row is still `status = 'pending'`, the problem is upstream of the database, in steps 1–2.

**4. Check whether Realtime is actually enabled for this table.**
Supabase-style realtime typically requires a table to be explicitly added to a publication (e.g. `supabase_realtime`) before `UPDATE` events broadcast at all — creating the table alone doesn't enable this. Confirm:
```sql
SELECT * FROM pg_publication_tables WHERE tablename = 'commands';
```
If this returns nothing, the table was never added to the realtime publication, and no amount of frontend subscription code will ever receive an event, regardless of how correctly it's written.

**5. Check whether Row Level Security is silently blocking the realtime broadcast.**
Realtime often respects RLS the same way normal queries do — if the authenticated frontend session doesn't have a `SELECT` policy that matches the row being updated, the broadcast may simply never reach that client, with no visible error. Confirm the subscribing user's `auth.uid()` actually matches the row's `user_id`.

**6. Check the frontend subscription channel and filter syntax match the actual table/schema exactly.**
A mismatched channel name, table name, or schema (e.g. subscribing to `commands:all` when the actual channel format expected is `postgres_changes` with a specific `schema`/`table`/`filter` object) will silently receive nothing, with no error thrown.

Work through these in order — the first one that reveals a discrepancy from what's expected is very likely the actual bug, and everything downstream of it is probably fine.

---

## 10. Testing Checklist

- [ ] Attempting to insert an `action_type` outside the allowed four via a raw SQL statement is rejected by the CHECK constraint
- [ ] `POST /api/v1/actions` with an invalid `action_type` returns 400, not a silent failure
- [ ] `POST /api/v1/actions` with params missing a required field (e.g. `update_resource_limits` with no `deployment_name`) returns 422
- [ ] `GET /api/v1/actions/pending` correctly transitions fetched rows to `in_progress`, and a second immediate poll doesn't return the same rows again
- [ ] Each of the four action handlers, tested individually against a real local cluster, performs exactly the Kubernetes operation it claims to (verify with `kubectl get`/`describe` after each)
- [ ] A deliberately failing action (e.g. `scale_deployment` on a deployment name that doesn't exist) reports `status: failed` with a real error message, not a silent hang
- [ ] The frontend shows the `in_progress` state distinctly, not just jumping from "pending" to a final state
- [ ] Realtime updates actually reach the UI without a manual page refresh, for both success and failure outcomes
- [ ] The agent's RBAC ServiceAccount genuinely cannot perform any operation outside the four scoped verbs (test by attempting an out-of-scope `kubectl` operation using the same ServiceAccount's token, confirm it's denied)

---

*Kubric Auto-Fix Pipeline v2 — structured, allow-listed actions only. No shell execution, no free-text commands, no unbounded attack surface.*
