from k8s.client import v1, serialize_and_prune
from typing import Dict, Any, List
from loguru import logger

class PodInspector:
    """Inspector for Kubernetes pods — returns rich, diagnostically complete data."""

    UNHEALTHY_STATES = [
        "CrashLoopBackOff",
        "ImagePullBackOff",
        "Pending",
        "Error",
        "OOMKilled",
        "ContainerCreating"
    ]

    def _extract_container_detail(self, cs: dict, spec_containers: list) -> dict:
        """Build a rich detail dict for a single container status entry."""
        container_name = cs.get("name", "unknown")
        state = cs.get("state", {})
        last_state = cs.get("lastState", {})

        # Current state
        waiting = state.get("waiting", {})
        terminated = state.get("terminated", {})
        running = state.get("running", {})

        # Last state (for exit code on CrashLoopBackOff)
        last_terminated = last_state.get("terminated", {})

        # Find the matching container spec to get command/args/image
        spec = {}
        for sc in spec_containers:
            if sc.get("name") == container_name:
                spec = sc
                break

        detail = {
            "container_name": container_name,
            "image": cs.get("image", spec.get("image", "unknown")),
            "restart_count": cs.get("restartCount", 0),
            "ready": cs.get("ready", False),
        }

        # Include command and args from the pod spec — this is critical for diagnosis
        if spec.get("command"):
            detail["command"] = spec["command"]
        if spec.get("args"):
            detail["args"] = spec["args"]

        # Current state details
        if waiting:
            detail["current_state"] = "waiting"
            detail["waiting_reason"] = waiting.get("reason", "")
            detail["waiting_message"] = waiting.get("message", "")
        elif terminated:
            detail["current_state"] = "terminated"
            detail["terminated_reason"] = terminated.get("reason", "")
            detail["exit_code"] = terminated.get("exitCode")
            detail["signal"] = terminated.get("signal")
        elif running:
            detail["current_state"] = "running"
        
        # Last termination (crucial for CrashLoopBackOff where current state is "waiting")
        if last_terminated:
            detail["last_exit_code"] = last_terminated.get("exitCode")
            detail["last_terminated_reason"] = last_terminated.get("reason", "")
            detail["last_signal"] = last_terminated.get("signal")

        return detail

    def inspect(self, context: str = None, namespace: str = None) -> Dict[str, Any]:
        """Gets pod status and detects unhealthy pods with full diagnostic context."""
        logger.info(f"Inspecting pods in namespace: {namespace or 'all'}...")
        try:
            if namespace:
                pods_obj = v1.list_namespaced_pod(namespace)
            else:
                pods_obj = v1.list_pod_for_all_namespaces()
            output = serialize_and_prune(pods_obj)
        except Exception as e:
            logger.error(f"Failed to fetch pods: {e}")
            return {"healthy": False, "problematic_pods": [], "error": f"Failed to fetch pods: {e}"}

        problematic_pods = []
        for pod in output["items"]:
            metadata = pod.get("metadata", {})
            status_obj = pod.get("status", {})
            spec = pod.get("spec", {})

            name = metadata.get("name", "unknown")
            ns = metadata.get("namespace", "unknown")
            phase = status_obj.get("phase", "Unknown")
            spec_containers = spec.get("containers", [])

            container_statuses = status_obj.get("containerStatuses", [])
            state_reason = phase
            is_unhealthy = False
            container_details = []

            for cs in container_statuses:
                state = cs.get("state", {})
                waiting = state.get("waiting", {})
                terminated = state.get("terminated", {})

                reason = waiting.get("reason") or terminated.get("reason")
                if reason in self.UNHEALTHY_STATES:
                    is_unhealthy = True
                    state_reason = reason

                # Always extract details for unhealthy containers
                detail = self._extract_container_detail(cs, spec_containers)
                container_details.append(detail)

            if phase in ["Failed", "Pending", "Unknown"] or is_unhealthy:
                problematic_pods.append({
                    "name": name,
                    "namespace": ns,
                    "phase": phase,
                    "status": state_reason,
                    "containers": container_details,
                })

        is_cluster_healthy = len(problematic_pods) == 0
        return {
            "healthy": is_cluster_healthy,
            "problematic_pods": problematic_pods
        }
