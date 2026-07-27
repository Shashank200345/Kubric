import asyncio
import os
import httpx
from datetime import datetime, timezone
from typing import Dict, Tuple

from loguru import logger
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException
from k8s.service import InvestigationService
from collector import StateCollector

try:
    config.load_incluster_config()
except config.ConfigException:
    config.load_kube_config()

v1 = client.CoreV1Api()
apps_v1 = client.AppsV1Api()

# In-memory store to avoid duplicate incident reports
# Key:   (namespace, pod_name, reason)
# Value: {"detected_at": str ISO-8601, "resolved": bool}
_incidents: Dict[Tuple[str, str, str], dict] = {}

_CRASH_REASON = "CrashLoopBackOff"
_OOM_REASON = "OOMKilled"
_IMAGE_PULL_REASONS = ["ImagePullBackOff", "ErrImagePull"]

BACKEND_INGEST_URL = os.getenv("INGESTION_ENDPOINT", "http://host.minikube.internal:8000/api/v1/ingest")
CLUSTER_TOKEN = os.getenv("CLUSTER_TOKEN", "default-token")
CLUSTER_NAME = os.getenv("CLUSTER_NAME", "minikube")

_state_collector = StateCollector(v1, apps_v1)


async def _push_state_once() -> None:
    """Collect a full cluster snapshot and push it to the backend (push architecture)."""
    try:
        snapshot = _state_collector.collect()
    except Exception as e:
        logger.error(f"[agent] Failed to collect cluster state: {e}")
        return

    snapshot["cluster_context"] = CLUSTER_NAME
    state_url = BACKEND_INGEST_URL.replace("/ingest", "/state")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client_http:
            resp = await client_http.post(
                state_url,
                json=snapshot,
                headers={"Authorization": f"Bearer {CLUSTER_TOKEN}"},
            )
            resp.raise_for_status()
            logger.info(
                f"[agent] Pushed cluster state: {len(snapshot['pods'])} pods, "
                f"{len(snapshot['workloads'])} workloads, {len(snapshot['nodes'])} nodes."
            )
    except Exception as e:
        logger.error(f"[agent] Failed to push cluster state: {e}")

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
            elif waiting_reason in _IMAGE_PULL_REASONS:
                unhealthy.add((ns, name, "ImagePullBackOff"))
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
                async with httpx.AsyncClient(timeout=60.0) as client_http:
                    resp = await client_http.post(
                        BACKEND_INGEST_URL,
                        json=payload,
                        headers={"Authorization": f"Bearer {CLUSTER_TOKEN}"}
                    )
                    resp.raise_for_status()
                    logger.info("[agent] Successfully ingested by backend.")
            except Exception as e:
                logger.error(f"[agent] Failed to push incident to backend: {e}")
                # Remove from tracking so we retry on the next polling cycle
                del _incidents[key]

    # ── Resolve incidents whose pods are healthy again
    for key, info in _incidents.items():
        (ns, pod, reason) = key
        if info["resolved"]:
            continue
        if (ns, pod, reason) not in currently_unhealthy:
            _incidents[key]["resolved"] = True
            logger.info(f"[agent] RESOLVED: {pod} pod no longer {reason} in namespace {ns}")


# --- Action Handlers ---

def handle_restart_pod(params: dict) -> dict:
    v1.delete_namespaced_pod(
        name=params["pod_name"],
        namespace=params["namespace"]
    )
    return {"message": f"Pod '{params['pod_name']}' deleted for restart."}

def handle_rollback_deployment(params: dict) -> dict:
    """Roll back a deployment to its previous revision via the Kubernetes API.
    
    This is the equivalent of `kubectl rollout undo deployment/<name> -n <ns>`.
    The Kubernetes API doesn't expose a direct "undo" endpoint, so we:
    1. Read the rollout history to find the previous ReplicaSet.
    2. Read that RS's pod template.
    3. Patch the deployment's template to match the previous RS's template.
    """
    import copy
    name = params["deployment_name"]
    ns = params["namespace"]

    # 1. Get the deployment's current revision
    deployment = apps_v1.read_namespaced_deployment(name, ns)
    current_revision = int(deployment.metadata.annotations.get("deployment.kubernetes.io/revision", "0"))

    if current_revision < 2:
        raise Exception(f"Deployment '{name}' has only 1 revision — nothing to roll back to.")

    # 2. Find the ReplicaSet for the previous revision
    target_revision = str(current_revision - 1)
    rs_list = apps_v1.list_namespaced_replica_set(
        namespace=ns,
        label_selector=",".join(f"{k}={v}" for k, v in (deployment.spec.selector.match_labels or {}).items())
    )

    prev_rs = None
    for rs in rs_list.items:
        rs_rev = (rs.metadata.annotations or {}).get("deployment.kubernetes.io/revision", "")
        if rs_rev == target_revision:
            prev_rs = rs
            break

    if not prev_rs:
        raise Exception(f"Could not find ReplicaSet for revision {target_revision} of deployment '{name}'.")

    # 3. Patch the deployment's pod template to the previous RS's template
    # (this is exactly what kubectl rollout undo does under the hood)
    prev_template = prev_rs.spec.template
    body = {
        "spec": {
            "template": prev_template.to_dict()
        }
    }
    apps_v1.patch_namespaced_deployment(name=name, namespace=ns, body=body)
    return {"message": f"Rolled back deployment '{name}' to revision {target_revision}."}

def handle_update_resource_limits(params: dict) -> dict:
    # Build the patch for the specific container
    containers = []
    
    # We need to fetch current deployment to correctly patch one container
    deployment = apps_v1.read_namespaced_deployment(params["deployment_name"], params["namespace"])
    for c in deployment.spec.template.spec.containers:
        if c.name == params["container_name"]:
            resources = {"limits": {}, "requests": {}}
            if params.get("memory_limit"):
                resources["limits"]["memory"] = params["memory_limit"]
                resources["requests"]["memory"] = params["memory_limit"]
            if params.get("cpu_limit"):
                resources["limits"]["cpu"] = params["cpu_limit"]
                resources["requests"]["cpu"] = params["cpu_limit"]
            containers.append({
                "name": c.name,
                "resources": resources
            })
    
    body = {
        "spec": {
            "template": {
                "spec": {
                    "containers": containers
                }
            }
        }
    }
    apps_v1.patch_namespaced_deployment(
        name=params["deployment_name"],
        namespace=params["namespace"],
        body=body
    )
    return {"message": f"Updated resource limits for container '{params['container_name']}' in deployment '{params['deployment_name']}'."}

def handle_scale_deployment(params: dict) -> dict:
    body = {
        "spec": {
            "replicas": params["replicas"]
        }
    }
    apps_v1.patch_namespaced_deployment(
        name=params["deployment_name"],
        namespace=params["namespace"],
        body=body
    )
    return {"message": f"Scaled deployment '{params['deployment_name']}' to {params['replicas']} replicas."}

def handle_update_image(params: dict) -> dict:
    deployment = apps_v1.read_namespaced_deployment(
        name=params["deployment_name"],
        namespace=params["namespace"]
    )
    containers = []
    for c in deployment.spec.template.spec.containers:
        if c.name == params["container_name"]:
            containers.append({
                "name": c.name,
                "image": params["image"]
            })
        else:
            containers.append({
                "name": c.name,
                "image": c.image
            })
    
    body = {
        "spec": {
            "template": {
                "spec": {
                    "containers": containers
                }
            }
        }
    }
    apps_v1.patch_namespaced_deployment(
        name=params["deployment_name"],
        namespace=params["namespace"],
        body=body
    )
    return {"message": f"Updated image for container '{params['container_name']}' in deployment '{params['deployment_name']}' to '{params['image']}'."}

def handle_update_environment_variable(params: dict) -> dict:
    deployment = apps_v1.read_namespaced_deployment(
        name=params["deployment_name"],
        namespace=params["namespace"]
    )
    containers = []
    for c in deployment.spec.template.spec.containers:
        if c.name == params["container_name"]:
            env_vars = c.env or []
            # Check if env exists
            found = False
            for e in env_vars:
                if e.name == params["env_name"]:
                    e.value = params["env_value"]
                    found = True
                    break
            if not found:
                from kubernetes.client.models import V1EnvVar
                env_vars.append(V1EnvVar(name=params["env_name"], value=params["env_value"]))
            
            containers.append({
                "name": c.name,
                "env": [e.to_dict() for e in env_vars]
            })
        else:
            containers.append({
                "name": c.name,
                "env": [e.to_dict() for e in (c.env or [])]
            })
    
    body = {
        "spec": {
            "template": {
                "spec": {
                    "containers": containers
                }
            }
        }
    }
    apps_v1.patch_namespaced_deployment(
        name=params["deployment_name"],
        namespace=params["namespace"],
        body=body
    )
    return {"message": f"Updated environment variable '{params['env_name']}' for container '{params['container_name']}' in deployment '{params['deployment_name']}'."}

ACTION_HANDLERS = {
    "restart_pod": handle_restart_pod,
    "rollback_deployment": handle_rollback_deployment,
    "update_resource_limits": handle_update_resource_limits,
    "scale_deployment": handle_scale_deployment,
    "update_image": handle_update_image,
    "update_environment_variable": handle_update_environment_variable,
}

async def _fetch_and_execute_actions() -> None:
    logger.info("[agent] _fetch_and_execute_actions called!")
    backend_url = BACKEND_INGEST_URL.replace("/ingest", "/actions")
    pending_url = f"{backend_url}/pending"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            resp = await client_http.get(
                pending_url,
                headers={"Authorization": f"Bearer {CLUSTER_TOKEN}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                actions = data.get("actions", [])
                for action_obj in actions:
                    action_id = action_obj.get("id")
                    action_type = action_obj.get("action_type")
                    params = action_obj.get("params", {})
                    
                    logger.info(f"[agent] Executing pending action {action_id} ({action_type})")
                    
                    # Execute
                    try:
                        handler = ACTION_HANDLERS.get(action_type)
                        if not handler:
                            raise Exception(f"Unknown action_type: {action_type}")
                            
                        result_dict = handler(params)
                        status = "success"
                        output = result_dict
                    except ApiException as e:
                        if e.status == 404:
                            status = "failed"
                            output = {"error": f"Resource not found (404) in namespace '{params.get('namespace', 'unknown')}' — it may have already been deleted, renamed, or resolved manually before this action ran."}
                        elif e.status == 409:
                            status = "failed"
                            output = {"error": f"Conflict updating resource (409) — it was modified concurrently. Not applied; consider re-running diagnosis for fresh evidence."}
                        else:
                            status = "failed"
                            output = {"error": f"Kubernetes API error ({e.status}): {e.reason}"}
                    except Exception as e:
                        status = "failed"
                        output = {"error": str(e)}
                        
                    # Post result
                    result_url = f"{backend_url}/{action_id}/result"
                    await client_http.post(
                        result_url,
                        headers={"Authorization": f"Bearer {CLUSTER_TOKEN}"},
                        json={"status": status, "output": output}
                    )
                    logger.info(f"[agent] Action {action_id} finished with status: {status}")
    except Exception as e:
        logger.error(f"[agent] Failed to fetch/execute actions: {e}")

async def _poll_loop(interval_s: int) -> None:
    from pathlib import Path
    logger.info(f"[agent] Polling started every {interval_s}s. Target backend: {BACKEND_INGEST_URL}")
    Path("/tmp/kubric-heartbeat").touch()
    while True:
        await _push_state_once()
        await _scan_once()
        await _fetch_and_execute_actions()
        Path("/tmp/kubric-heartbeat").touch()
        await asyncio.sleep(interval_s)

if __name__ == "__main__":
    interval = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))
    asyncio.run(_poll_loop(interval))
