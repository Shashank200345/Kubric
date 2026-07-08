from k8s.client import apps_v1, serialize_and_prune
from typing import Dict, Any, List
from loguru import logger

class DeploymentInspector:
    """Inspector for Kubernetes deployments."""

    def inspect(self, context: str = None, namespace: str = None) -> List[Dict[str, Any]]:
        """
        Inspects deployments and checks for issues like unavailable replicas.
        Returns:
            List of unhealthy deployments.
        """
        logger.info(f"Inspecting deployments in namespace: {namespace or 'all'}...")
        try:
            if namespace:
                deps_obj = apps_v1.list_namespaced_deployment(namespace)
            else:
                deps_obj = apps_v1.list_deployment_for_all_namespaces()
            output = serialize_and_prune(deps_obj)
        except Exception as e:
            logger.error(f"Failed to fetch deployments: {e}")
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
