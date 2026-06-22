from app.kubernetes.executor import KubectlExecutor
from typing import Dict, Any, List
from loguru import logger

class DeploymentInspector:
    """Inspector for Kubernetes deployments."""

    def inspect(self, context: str = None) -> List[Dict[str, Any]]:
        """
        Inspects deployments and checks for issues like unavailable replicas.
        Returns:
            List of unhealthy deployments.
        """
        logger.info("Inspecting deployments...")
        command = "kubectl get deployments -A -o json"
        output = KubectlExecutor.run(command, parse_json=True, context=context)
        
        if not output or "items" not in output:
            return []
            
        unhealthy_deployments = []
        for dep in output["items"]:
            metadata = dep.get("metadata", {})
            status = dep.get("status", {})
            
            name = metadata.get("name", "unknown")
            namespace = metadata.get("namespace", "unknown")
            
            desired_replicas = dep.get("spec", {}).get("replicas", 1)
            ready_replicas = status.get("readyReplicas", 0)
            unavailable_replicas = status.get("unavailableReplicas", 0)
            
            # Check conditions for rollout failures
            conditions = status.get("conditions", [])
            rollout_failed = any(
                c.get("type") == "Progressing" and c.get("status") == "False"
                for c in conditions
            )
            
            if unavailable_replicas > 0 or desired_replicas != ready_replicas or rollout_failed:
                unhealthy_deployments.append({
                    "name": name,
                    "namespace": namespace,
                    "desired_replicas": desired_replicas,
                    "ready_replicas": ready_replicas,
                    "unavailable_replicas": unavailable_replicas,
                    "rollout_failed": rollout_failed
                })
                
        return unhealthy_deployments
