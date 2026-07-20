# Kubric Auto-Fix — Final Test Runbook

Validate every fix the agent can apply through **Approve & Run Fix** before release.

All test workloads live in the `kubric-fix-tests` namespace.

## 0. Prerequisites
- A running cluster reachable by the backend (`kubectl get nodes` works).
- Backend running locally and the in-cluster agent installed (so `Approve & Run Fix` can dispatch actions).
- Frontend running (`npm run dev`) and signed in.

## 1. Deploy the scenarios
```bash
kubectl apply -f kubric-cli/test-manifests/autofix-scenarios.yaml
kubectl -n kubric-fix-tests get pods
```

## 2. Trigger and verify each fix

### A. OOMKilled → update_resource_limits  (deterministic)
1. `oom-autofix` enters `OOMKilled` / `CrashLoopBackOff`.
2. Dashboard → **Troubleshoot** → select the cluster → **Scan Cluster**.
3. Root cause should reference memory / OOM; suggested action = `update_resource_limits`.
4. Click **Approve & Run Fix**.
5. Verify:
   ```bash
   kubectl -n kubric-fix-tests get deploy oom-autofix -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}'; echo
   ```
   The memory limit should be raised above 50Mi.

### B. Missing env var → update_environment_variable  (deterministic)
1. `missing-env-autofix` is in `CrashLoopBackOff` (exits because `REQUIRED_VAR` is unset).
2. Scan → suggested action = `update_environment_variable` (sets `REQUIRED_VAR`).
3. **Approve & Run Fix**.
4. Verify the pod reaches `Running`:
   ```bash
   kubectl -n kubric-fix-tests get pods -l app=missing-env-autofix
   kubectl -n kubric-fix-tests set env deploy/missing-env-autofix --list | grep REQUIRED_VAR
   ```

### C. Bad rollout → rollback_deployment  (needs the 2-step break)
1. Break the healthy baseline to create a failing rollout with prior history:
   ```bash
   kubectl -n kubric-fix-tests set image deployment/rollback-autofix \
     app=nginx:this-tag-does-not-exist-9999
   ```
2. New pod goes `ImagePullBackOff`; revision 1 remains good.
3. Scan → suggested action = `rollback_deployment`.
4. **Approve & Run Fix**.
5. Verify it returns to the working image:
   ```bash
   kubectl -n kubric-fix-tests rollout history deployment/rollback-autofix
   kubectl -n kubric-fix-tests get deploy rollback-autofix -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
   ```

### D. Stuck pod → restart_pod  (LLM-judged)
1. After ~30s `stuck-pod-autofix` becomes `NotReady` but keeps running (no auto-restart).
2. Scan → the agent should identify a wedged/unhealthy pod; suggested action = `restart_pod`.
3. **Approve & Run Fix**.
4. Verify a fresh pod (new age / restart) is `Running` and `Ready`:
   ```bash
   kubectl -n kubric-fix-tests get pods -l app=stuck-pod-autofix
   ```

### E. Over-provisioned replicas → scale_deployment  (scan-detected)
1. `scale-autofix` requests 10 replicas at 500m CPU each; the cluster can't fit
   them all, so several pods stay `Pending` (FailedScheduling: Insufficient cpu).
2. Scan → root cause identifies unschedulable/pending pods; suggested action =
   `scale_deployment` (scale DOWN to the number that fits).
3. **Approve & Run Fix**.
4. Verify replicas were reduced and remaining pods are Running:
   ```bash
   kubectl -n kubric-fix-tests get deploy scale-autofix -o jsonpath='{.spec.replicas}'; echo
   kubectl -n kubric-fix-tests get pods -l app=scale-autofix
   ```

## 3. Cleanup
```bash
kubectl delete ns kubric-fix-tests
# also undo the rollback-test break if you re-run:
# (namespace delete removes everything, so this is only needed for partial runs)
```

## Notes
- A/B are fully deterministic and are the core release gate.
- C requires the 2-step break so a previous revision exists to roll back to.
- D/E depend on the LLM proposing that specific action; the agent's guardrails
  (deterministic backstop + plausibility check) may decline an action it deems
  unsafe — that is expected behavior, not a failure.
