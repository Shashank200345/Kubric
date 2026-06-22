# End-to-End Integration & Real Testing Implementation Plan

We are going to implement the final phase: end-to-end integration, reliability improvements, loading/empty states, and intentional test scenarios. 

## User Review Required
> [!IMPORTANT]
> - We will update your backend to fetch all Kubernetes contexts from your `kubeconfig`.
> - The frontend will display a dropdown to select the target cluster for investigation.
> - We will create a `test-scenarios.yaml` file that you can apply to test real Kubernetes failures.
> - Do you want to limit the cluster selection to certain patterns, or just list all contexts found in `kubeconfig`?

## Open Questions
- Is there any specific Kubernetes context or cluster you want to exclude from the dropdown? (By default, we will list all contexts found in `kubectl config get-contexts -o name`).

## Proposed Changes

### Backend Changes

#### [MODIFY] `backend/app/main.py`
- Add a new GET endpoint `/clusters` that executes `kubectl config get-contexts -o name` to retrieve all available clusters on the local machine.
- Update the `/investigate` endpoint's `InvestigationRequest` schema to accept a `cluster_context: str` field.
- Pass `cluster_context` into `InvestigationService.run_investigation()`.

#### [MODIFY] `backend/app/kubernetes/executor.py`
- Update `KubectlExecutor.run()` to accept a new `context: str` parameter.
- When `context` is provided, append `--context={context}` to the `kubectl` command.
- Improve error handling to catch unreachable clusters, missing kubeconfig, and return beginner-friendly error messages like `"Unable to connect to Kubernetes cluster."` rather than raw tracebacks.

#### [MODIFY] `backend/app/kubernetes/service.py` & `inspectors/*.py`
- Update `InvestigationService` and all inspector classes (`PodInspector`, `LogsCollector`, etc.) to accept the `context` parameter and pass it down to `KubectlExecutor`.

---

### Frontend Changes

#### [MODIFY] `frontend/src/app/page.tsx`
- **Cluster Selection**: Add a dropdown above the "Investigate Cluster" button that allows the user to select the target cluster. Fetch the list of clusters from the new `/clusters` backend endpoint.
- **Payload Update**: Pass the selected cluster in the payload to `/investigate`.
- **Loading States**: Add specific empty states ("No critical Kubernetes issues detected. Cluster appears healthy.") when the diagnosis returns empty or healthy results.
- **Error Handling UX**: Display friendly error messages directly in the UI if the backend reports a connection failure (e.g. cluster is unreachable).

---

### Test Scenarios

#### [NEW] `test-scenarios.yaml`
We will create a YAML manifest containing four intentional failure scenarios for you to test the agent's effectiveness:
1. **CrashLoopBackOff**: A pod missing a required environment variable.
2. **ImagePullBackOff**: A pod trying to pull `nginx:invalid-tag-12345`.
3. **OOMKilled**: A pod with strict memory limits running a memory-hogging script.
4. **Service Selector Mismatch**: A service whose selector labels do not match its corresponding deployment.

## Verification Plan

### Manual Verification
1. I will apply the `test-scenarios.yaml` on your local cluster.
2. I will trigger the investigation through the frontend by selecting the target cluster.
3. We will verify that the AI Kubernetes Agent accurately diagnoses all 4 failure scenarios.
