from k8s.client import v1, serialize_and_prune
from typing import Dict, Any, List
from loguru import logger

class NetworkInspector:
    """Inspector for Kubernetes networking and services."""

    def inspect(self, context: str = None, namespace: str = None) -> List[Dict[str, Any]]:
        """
        Inspects services and endpoints to find networking issues.
        Returns:
            List of network issues found.
        """
        logger.info(f"Inspecting networking in namespace: {namespace or 'all'}...")
        
        try:
            if namespace:
                svc_obj = v1.list_namespaced_service(namespace)
                ep_obj = v1.list_namespaced_endpoints(namespace)
            else:
                svc_obj = v1.list_service_for_all_namespaces()
                ep_obj = v1.list_endpoints_for_all_namespaces()
                
            services_output = serialize_and_prune(svc_obj)
            endpoints_output = serialize_and_prune(ep_obj)
        except Exception as e:
            logger.error(f"Failed to fetch networking: {e}")
            return []
            
        issues = []
        
        # Build endpoints map for quick lookup
        endpoints_map = {}
        if endpoints_output and "items" in endpoints_output:
            for ep in endpoints_output["items"]:
                ns = ep.get("metadata", {}).get("namespace", "")
                name = ep.get("metadata", {}).get("name", "")
                endpoints_map[f"{ns}/{name}"] = ep
        
        for svc in services_output["items"]:
            metadata = svc.get("metadata", {})
            spec = svc.get("spec", {})
            
            name = metadata.get("name", "unknown")
            namespace = metadata.get("namespace", "unknown")
            svc_type = spec.get("type", "ClusterIP")
            
            # ExternalName doesn't have selectors/endpoints in the same way
            if svc_type == "ExternalName":
                continue
                
            selector = spec.get("selector", {})
            # If a service has no selector, it might be intentionally mapping external endpoints,
            # but usually it's a misconfiguration. We will flag it if it has a selector but no endpoints.
            
            ep_key = f"{namespace}/{name}"
            ep = endpoints_map.get(ep_key)
            
            subsets = ep.get("subsets", []) if ep else []
            has_endpoints = any(len(subset.get("addresses", [])) > 0 for subset in subsets)
            
            if selector and not has_endpoints:
                issues.append({
                    "service": name,
                    "namespace": namespace,
                    "issue": "Missing endpoints (selector mismatch or pods unhealthy)",
                    "selector": selector
                })
                
        return issues
