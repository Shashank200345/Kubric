import re
from app.kubernetes.executor import KubectlExecutor
from typing import Dict, Any, List
from loguru import logger

_RESOURCE_NAME_PATTERN = re.compile(r"^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$", re.IGNORECASE)

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
            name = str(pod.get("name") or "")
            namespace = str(pod.get("namespace") or "")
            
            if not name or not namespace:
                continue

            # Prevent option/flag injection (e.g. name="--all") and invalid characters
            if name.startswith("-") or namespace.startswith("-") or not _RESOURCE_NAME_PATTERN.match(name) or not _RESOURCE_NAME_PATTERN.match(namespace):
                logger.warning(f"Skipping invalid pod name or namespace for logs collection: name={name}, namespace={namespace}")
                continue
                
            # Fetch tail of 50 lines to keep it concise
            command = f"kubectl logs {name} -n {namespace} --tail=50"
            try:
                logs = KubectlExecutor.run(command, parse_json=False, context=context)
                
                # Sometimes pods crash before logs are available or have previous logs
                if not logs:
                    try:
                        command_prev = f"kubectl logs {name} -n {namespace} --tail=50 --previous"
                        logs = KubectlExecutor.run(command_prev, parse_json=False, context=context)
                    except Exception as e:
                        logger.warning(f"Failed to fetch previous logs for {name}: {e}")
                        logs = "No logs available. Container may have failed to start entirely."
                        
            except Exception as e:
                logger.warning(f"Failed to fetch logs for {name}: {e}")
                # Try falling back to previous logs just in case
                try:
                    command_prev = f"kubectl logs {name} -n {namespace} --tail=50 --previous"
                    logs = KubectlExecutor.run(command_prev, parse_json=False, context=context)
                except Exception as inner_e:
                    logs = f"Could not fetch logs: {e}"
            
            key = f"{namespace}/{name}"
            collected_logs[key] = logs if logs else "No logs available."
            
        return collected_logs
