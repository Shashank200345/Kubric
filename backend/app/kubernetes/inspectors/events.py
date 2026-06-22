from app.kubernetes.executor import KubectlExecutor
from typing import Dict, Any, List
from loguru import logger

class EventsAnalyzer:
    """Analyzer for Kubernetes events."""

    WARNING_REASONS = [
        "FailedScheduling",
        "BackOff",
        "FailedMount",
        "FailedPull",
        "ErrImagePull",
        "Unhealthy"
    ]

    def analyze(self, context: str = None) -> List[Dict[str, str]]:
        """
        Reads Kubernetes events and detects warnings.
        Returns:
            List of summarized findings.
        """
        logger.info("Analyzing Kubernetes events...")
        command = "kubectl get events -A --field-selector type=Warning -o json"
        output = KubectlExecutor.run(command, parse_json=True, context=context)
        
        if not output or "items" not in output:
            return []
            
        warnings = []
        for event in output["items"]:
            reason = event.get("reason", "")
            if reason in self.WARNING_REASONS or reason:
                involved_object = event.get("involvedObject", {})
                obj_kind = involved_object.get("kind", "Unknown")
                obj_name = involved_object.get("name", "Unknown")
                obj_ns = involved_object.get("namespace", "Unknown")
                message = event.get("message", "No message")
                
                warnings.append({
                    "reason": reason,
                    "kind": obj_kind,
                    "name": obj_name,
                    "namespace": obj_ns,
                    "message": message
                })
                
        return warnings
