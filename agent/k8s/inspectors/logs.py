from k8s.client import v1
from typing import Dict, Any, List
from loguru import logger

class LogsCollector:
    """Collector for Kubernetes pod logs."""

    def collect(self, problematic_pods: List[Dict[str, Any]], context: str = None) -> Dict[str, str]:
        """
        Fetches relevant logs for the failed pods.
        Args:
            problematic_pods: List of pods from PodInspector.
        Returns:
            Dict mapping "namespace/pod_name" to logs string.
        """
        logger.info(f"Collecting logs for {len(problematic_pods)} problematic pods...")
        collected_logs = {}
        
        for pod in problematic_pods:
            name = pod.get("name")
            namespace = pod.get("namespace")
            
            if not name or not namespace:
                continue
                
            # Fetch tail of 50 lines to keep it concise
            try:
                logs = v1.read_namespaced_pod_log(name, namespace, tail_lines=50)
                
                # Sometimes pods crash before logs are available or have previous logs
                if not logs:
                    try:
                        logs = v1.read_namespaced_pod_log(name, namespace, tail_lines=50, previous=True)
                    except Exception as e:
                        logger.warning(f"Failed to fetch previous logs for {name}: {e}")
                        logs = "No logs available. Container may have failed to start entirely."
                        
            except Exception as e:
                logger.warning(f"Failed to fetch logs for {name}: {e}")
                # Try falling back to previous logs just in case
                try:
                    logs = v1.read_namespaced_pod_log(name, namespace, tail_lines=50, previous=True)
                except Exception as inner_e:
                    logs = f"Could not fetch logs: {e}"
            
            key = f"{namespace}/{name}"
            collected_logs[key] = logs if logs else "No logs available."
            
        return collected_logs
