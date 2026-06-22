from app.kubernetes.executor import KubectlExecutor
from typing import Dict, Any, List
from loguru import logger

class NetworkInspector:
    """Inspector for Kubernetes networking and services."""

    def inspect(self, context: str = None) -> List[Dict[str, Any]]:
        """
        Inspects services and endpoints to find networking issues.
        Returns:
            List of network issues found.
        """
        logger.info("Inspecting networking...")
        
        services_output = KubectlExecutor.run("kubectl get svc -A -o json", parse_json=True, context=context)
        endpoints_output = KubectlExecutor.run("kubectl get endpoints -A -o json", parse_json=True, context=context)
        
        if not services_output or "items" not in services_output:
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
