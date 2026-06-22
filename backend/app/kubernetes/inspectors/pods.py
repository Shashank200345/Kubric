from app.kubernetes.executor import KubectlExecutor
from typing import Dict, Any, List
from loguru import logger

class PodInspector:
    """Inspector for Kubernetes pods."""

    UNHEALTHY_STATES = [
        "CrashLoopBackOff",
        "ImagePullBackOff",
        "Pending",
        "Error",
        "OOMKilled",
        "ContainerCreating"
    ]

    def inspect(self, context: str = None) -> Dict[str, Any]:
        """Gets pod status and detects unhealthy pods."""
        logger.info("Inspecting pods...")
        output = KubectlExecutor.run("kubectl get pods -A -o json", parse_json=True, context=context)
        
        if not output or "items" not in output:
            return {"healthy": False, "problematic_pods": [], "error": "Failed to fetch pods."}

        problematic_pods = []
        for pod in output["items"]:
            metadata = pod.get("metadata", {})
            status_obj = pod.get("status", {})
            
            name = metadata.get("name", "unknown")
            namespace = metadata.get("namespace", "unknown")
            phase = status_obj.get("phase", "Unknown")
            
            # Check container statuses for specific reasons
            container_statuses = status_obj.get("containerStatuses", [])
            state_reason = phase
            
            is_unhealthy = False
            for cs in container_statuses:
                state = cs.get("state", {})
                waiting = state.get("waiting", {})
                terminated = state.get("terminated", {})
                
                reason = waiting.get("reason") or terminated.get("reason")
                if reason in self.UNHEALTHY_STATES:
                    is_unhealthy = True
                    state_reason = reason
                    break
            
            if phase in ["Failed", "Pending", "Unknown"] or is_unhealthy:
                problematic_pods.append({
                    "name": name,
                    "namespace": namespace,
                    "status": state_reason
                })

        is_cluster_healthy = len(problematic_pods) == 0
        return {
            "healthy": is_cluster_healthy,
            "problematic_pods": problematic_pods
        }
