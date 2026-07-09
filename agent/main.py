import asyncio
import os
import httpx
from datetime import datetime, timezone
from typing import Dict, Tuple

from loguru import logger
from kubernetes import client, config
from k8s.service import InvestigationService

try:
    config.load_incluster_config()
except config.ConfigException:
    config.load_kube_config()

v1 = client.CoreV1Api()

# In-memory store to avoid duplicate incident reports
# Key:   (namespace, pod_name, reason)
# Value: {"detected_at": str ISO-8601, "resolved": bool}
_incidents: Dict[Tuple[str, str, str], dict] = {}

_CRASH_REASON = "CrashLoopBackOff"
_OOM_REASON = "OOMKilled"

BACKEND_INGEST_URL = os.getenv("INGESTION_ENDPOINT", "http://host.minikube.internal:8000/api/v1/ingest")
CLUSTER_TOKEN = os.getenv("CLUSTER_TOKEN", "default-token")
CLUSTER_NAME = os.getenv("CLUSTER_NAME", "minikube")

def _extract_unhealthy_pods(pods: client.V1PodList) -> set:
    unhealthy = set()
    for pod in pods.items:
        ns = pod.metadata.namespace
        name = pod.metadata.name
        container_statuses = pod.status.container_statuses or []

        for cs in container_statuses:
            restart_count = cs.restart_count
            state = cs.state
            
            waiting_reason = state.waiting.reason if state and state.waiting else ""
            terminated_reason = state.terminated.reason if state and state.terminated else ""

            if waiting_reason == _CRASH_REASON:
                last_reason = cs.last_state.terminated.reason if (cs.last_state and cs.last_state.terminated) else ""
                if last_reason == _OOM_REASON:
                    unhealthy.add((ns, name, _OOM_REASON))
                else:
                    unhealthy.add((ns, name, _CRASH_REASON))
            elif terminated_reason == "Error" and restart_count >= 2:
                unhealthy.add((ns, name, _CRASH_REASON))
            elif terminated_reason == _OOM_REASON:
                unhealthy.add((ns, name, _OOM_REASON))

    return unhealthy


async def _scan_once() -> None:
    try:
        pods = v1.list_pod_for_all_namespaces()
    except Exception as e:
        logger.error(f"[agent] unexpected scan error: {e}")
        return

    currently_unhealthy = _extract_unhealthy_pods(pods)

    # ── Detect new incidents
    for (ns, pod, reason) in currently_unhealthy:
        key = (ns, pod, reason)
        if key not in _incidents or _incidents[key]["resolved"]:
            _incidents[key] = {
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "resolved": False,
            }
            logger.warning(f"[agent] NEW incident detected: {pod} pod {reason} in namespace {ns}")
            
            # Trigger Investigation Service
            logger.info("[agent] Gathering cluster evidence...")
            service = InvestigationService()
            # Because we're in-cluster, we don't pass a context, but we pass namespace to scope the search
            evidence = await service.run_investigation(context=None, namespace=ns)
            
            # Send payload to backend
            payload = {
                "cluster_context": CLUSTER_NAME,
                "reason": reason,
                "pod_name": pod,
                "namespace": ns,
                "evidence": evidence
            }
            
            try:
                logger.info(f"[agent] Pushing evidence to {BACKEND_INGEST_URL}...")
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(
                        BACKEND_INGEST_URL,
                        json=payload,
                        headers={"Authorization": f"Bearer {CLUSTER_TOKEN}"}
                    )
                    resp.raise_for_status()
                    logger.info("[agent] Successfully ingested by backend.")
            except Exception as e:
                logger.error(f"[agent] Failed to push incident to backend: {e}")

    # ── Resolve incidents whose pods are healthy again
    for key, info in _incidents.items():
        (ns, pod, reason) = key
        if info["resolved"]:
            continue
        if (ns, pod, reason) not in currently_unhealthy:
            _incidents[key]["resolved"] = True
            logger.info(f"[agent] RESOLVED: {pod} pod no longer {reason} in namespace {ns}")


async def _poll_loop(interval_s: int) -> None:
    logger.info(f"[agent] Polling started every {interval_s}s. Target backend: {BACKEND_INGEST_URL}")
    while True:
        await _scan_once()
        await asyncio.sleep(interval_s)

if __name__ == "__main__":
    interval = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))
    asyncio.run(_poll_loop(interval))
