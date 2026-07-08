from k8s.client import v1, serialize_and_prune
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

    def analyze(self, context: str = None, namespace: str = None) -> List[Dict[str, str]]:
        """
        Reads Kubernetes events and detects warnings.
        Returns:
            List of summarized findings.
        """
        logger.info(f"Analyzing Kubernetes events in namespace: {namespace or 'all'}...")
        try:
            if namespace:
                events_obj = v1.list_namespaced_event(namespace, field_selector="type=Warning")
            else:
                events_obj = v1.list_event_for_all_namespaces(field_selector="type=Warning")
            output = serialize_and_prune(events_obj)
        except Exception as e:
            logger.error(f"Failed to fetch events: {e}")
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
