from kubernetes import client, config
from loguru import logger

try:
    config.load_incluster_config()
except config.ConfigException:
    config.load_kube_config()

v1 = client.CoreV1Api()
apps_v1 = client.AppsV1Api()
api_client = client.ApiClient()

def serialize_and_prune(obj):
    """Serializes a K8s object and prunes noisy metadata."""
    parsed = api_client.sanitize_for_serialization(obj)
    
    def _prune(o):
        if isinstance(o, dict):
            if "metadata" in o and isinstance(o["metadata"], dict):
                o["metadata"].pop("managedFields", None)
                if "annotations" in o["metadata"] and isinstance(o["metadata"]["annotations"], dict):
                    o["metadata"]["annotations"].pop("kubectl.kubernetes.io/last-applied-configuration", None)
            for k, v in o.items():
                _prune(v)
        elif isinstance(o, list):
            for item in o:
                _prune(item)
                
    _prune(parsed)
    return parsed
