from typing import Dict, Any
from loguru import logger
from .inspectors import (
    PodInspector,
    LogsCollector,
    EventsAnalyzer,
    DeploymentInspector,
    NetworkInspector
)

from app.insforge_client import InsForgeClient

class InvestigationService:
    """Service to orchestrate Kubernetes troubleshooting investigation."""

    def __init__(self, client=None):
        self.client = client
        self.pod_inspector = PodInspector()
        self.logs_collector = LogsCollector()
        self.events_analyzer = EventsAnalyzer()
        self.deployment_inspector = DeploymentInspector()
        self.network_inspector = NetworkInspector()

    async def run_investigation(self, investigation_id: str = None, context: str = None) -> Dict[str, Any]:
        """
        Runs the full suite of inspectors to gather evidence.
        Returns:
            Structured dictionary of the findings.
        """
        logger.info(f"Starting Kubernetes investigation (context: {context or 'default'})...")
        
        async def report(step: str):
            import asyncio
            logger.info(f"Progress: {step}")
            if self.client and investigation_id:
                await self.client.update_progress(investigation_id, step)
                # Add a short delay to create a progressive scanning animation in the UI
                await asyncio.sleep(1.0)
        
        # 1. Check Pods
        await report("Checking Pods")
        pod_results = self.pod_inspector.inspect(context=context)
        
        # 2. Collect Logs (only for problematic pods)
        await report("Reading Logs")
        logs_results = {}
        if not pod_results.get("healthy", True):
            problematic_pods = pod_results.get("problematic_pods", [])
            logs_results = self.logs_collector.collect(problematic_pods, context=context)
            
        # 3. Analyze Events
        await report("Analyzing Events")
        events_results = self.events_analyzer.analyze(context=context)
        
        # 4. Inspect Deployments
        await report("Inspecting Deployments")
        deployment_results = self.deployment_inspector.inspect(context=context)
        
        # 5. Check Networking
        await report("Checking Networking")
        network_results = self.network_inspector.inspect(context=context)
        
        await report("AI Reasoning")
        logger.info("Investigation complete.")
        
        return {
            "pods": pod_results,
            "logs": logs_results,
            "events": events_results,
            "deployments": deployment_results,
            "network": network_results
        }
