from typing import Dict, Any
from loguru import logger
from .inspectors import (
    PodInspector,
    LogsCollector,
    EventsAnalyzer,
    DeploymentInspector,
    NetworkInspector
)

class InvestigationService:
    """Service to orchestrate Kubernetes troubleshooting investigation."""

    def __init__(self):
        self.pod_inspector = PodInspector()
        self.logs_collector = LogsCollector()
        self.events_analyzer = EventsAnalyzer()
        self.deployment_inspector = DeploymentInspector()
        self.network_inspector = NetworkInspector()

    async def run_investigation(self, investigation_id: str = None, context: str = None, namespace: str = None) -> Dict[str, Any]:
        """
        Runs the full suite of inspectors to gather evidence.
        Returns:
            Structured dictionary of the findings.
        """
        logger.info(f"Starting Kubernetes investigation (context: {context or 'default'}, namespace: {namespace or 'all'})...")
        
        async def report(step: str):
            import asyncio
            logger.info(f"Progress: {step}")
            await asyncio.sleep(0.1)
        
        # 1. Check Pods
        await report("Checking Pods")
        pod_results = self.pod_inspector.inspect(context=context, namespace=namespace)
        
        # 2. Collect Logs (only for problematic pods)
        await report("Reading Logs")
        logs_results = {}
        if not pod_results.get("healthy", True):
            problematic_pods = pod_results.get("problematic_pods", [])
            logs_results = self.logs_collector.collect(problematic_pods, context=context)
            
        # 3. Analyze Events
        await report("Analyzing Events")
        events_results = self.events_analyzer.analyze(context=context, namespace=namespace)
        
        # 4. Inspect Deployments
        await report("Inspecting Deployments")
        deployment_results = self.deployment_inspector.inspect(context=context, namespace=namespace)
        
        # 5. Check Networking
        await report("Checking Networking")
        network_results = self.network_inspector.inspect(context=context, namespace=namespace)
        
        await report("AI Reasoning")
        logger.info("Investigation complete.")
        
        return {
            "pods": pod_results,
            "logs": logs_results,
            "events": events_results,
            "deployments": deployment_results,
            "network": network_results
        }
