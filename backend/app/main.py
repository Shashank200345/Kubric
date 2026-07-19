import os
from fastapi import FastAPI, BackgroundTasks, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="AI Kubernetes Agent",
    description="Backend orchestrator for AI-driven Kubernetes troubleshooting",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting AI Kubernetes Agent backend...")
    
    # Docker networking fix: 
    # When running in a container, 127.0.0.1 refers to the container itself.
    # We must rewrite the mounted kubeconfig to point to the host machine.
    mounted_kubeconfig = "/root/.kube/config"
    if os.path.exists(mounted_kubeconfig):
        try:
            with open(mounted_kubeconfig, "r") as f:
                content = f.read()
            
            # Replace localhost IP/names with Docker's host gateway
            content = content.replace("127.0.0.1", "host.docker.internal")
            content = content.replace("0.0.0.0", "host.docker.internal")
            # We don't blindly replace "localhost" because it might be part of a URL path or name, 
            # but usually kubernetes API is an IP or "localhost:port"
            content = content.replace("https://localhost:", "https://host.docker.internal:")
            
            import re
            # Disable TLS verification because host.docker.internal is not in the cluster cert
            content = re.sub(r'certificate-authority.*:.*', 'insecure-skip-tls-verify: true', content)
            
            # Write to a writable location
            temp_kubeconfig = "/tmp/kubeconfig"
            with open(temp_kubeconfig, "w") as f:
                f.write(content)
            
            # Tell kubectl to use the rewritten config
            os.environ["KUBECONFIG"] = temp_kubeconfig
            logger.info("Successfully patched kubeconfig for Docker Desktop networking.")
        except Exception as e:
            logger.error(f"Failed to patch kubeconfig: {e}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-kubernetes-agent"
    }


# ============================================================
# CLI API Endpoints (v1) — used by the kubric-cli
# ============================================================
import uuid
import secrets
from pydantic import BaseModel as BaseModel2
from typing import Optional
from fastapi import HTTPException, Header

# In-memory store for device auth flows (production: use Redis or DB)
_device_auth_flows: dict = {}

class DeviceTokenRequest(BaseModel2):
    device_code: str

class ClusterConnectRequest(BaseModel2):
    cluster_name: str


@app.post("/v1/auth/device")
async def cli_start_device_auth():
    """Start the device auth flow for the CLI. Returns a verification URL and device code."""
    device_code = secrets.token_urlsafe(32)
    _device_auth_flows[device_code] = {
        "approved": True,  # Auto-approve for local dev — set to False for real flow
        "token": f"kubric_cli_{secrets.token_hex(16)}",
        "email": "developer@kubric.dev",
    }
    
    # In production this would be a real verification page
    verification_url = "http://localhost:3001/cli/verify?code=" + device_code
    
    return {
        "verification_url": verification_url,
        "device_code": device_code,
    }


@app.post("/v1/auth/device/token")
async def cli_poll_device_token(request: DeviceTokenRequest):
    """Poll for the auth token after the user approves in the browser."""
    from fastapi.responses import JSONResponse
    
    flow = _device_auth_flows.get(request.device_code)
    if not flow:
        raise HTTPException(status_code=404, detail="Unknown device code")
    
    if not flow["approved"]:
        # 428 Precondition Required tells the CLI to keep polling
        return JSONResponse(status_code=428, content={"detail": "Authorization pending"})
    
    return {
        "token": flow["token"],
        "email": flow["email"],
    }


@app.post("/v1/clusters/connect")
async def cli_connect_cluster(request: ClusterConnectRequest, authorization: Optional[str] = Header(None)):
    """Register a cluster and return the Helm values for installing the Kubric agent."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Generate a per-cluster agent token
    cluster_token = secrets.token_hex(32)
    
    return {
        "helm_values": {
            "agent.image.tag": "v0.1.0",
            "agent.clusterName": request.cluster_name,
            "agent.token": cluster_token,
            "agent.ingestionEndpoint": "http://localhost:8000/v1/ingest",
        }
    }


@app.get("/v1/status")
async def cli_get_status(cluster: str = "", authorization: Optional[str] = Header(None)):
    """Return a status snapshot for the CLI's `kubric status` command."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    def _fetch_cluster_status():
        """Synchronous kubectl calls — run in thread pool."""
        pods_running = 0
        pods_total = 0
        
        try:
            from app.kubernetes.executor import KubectlExecutor as KE
            
            try:
                pods_json = KE.run(
                    "kubectl get pods -A -o json", parse_json=True
                )
                all_pods = pods_json.get("items", [])
                pods_total = len(all_pods)
                pods_running = sum(
                    1 for p in all_pods
                    if p.get("status", {}).get("phase") == "Running"
                )
            except Exception:
                pass
        except ImportError:
            pass
        
        # Health score: simple heuristic based on pod health ratio
        if pods_total > 0:
            health_score = int((pods_running / pods_total) * 100)
        else:
            health_score = 100  # No pods = nothing unhealthy
        
        # Use real incident count from the detection poller
        active_incidents = incident_poller.get_active_incident_count(cluster or "minikube")
        return {
            "health_score": health_score,
            "active_incidents": active_incidents,
            "pods_running": pods_running,
            "pods_total": pods_total,
            "prs_pending": 0,
            "last_synced_seconds_ago": 5,
        }
    
    import asyncio
    return await asyncio.to_thread(_fetch_cluster_status)


from app.kubernetes.service import InvestigationService
from app.kubernetes.executor import KubectlExecutor, KubectlError, ClusterUnreachableError
from app.ai.agent import KubernetesAIAgent
from app.insforge_client import InsForgeClient
from pydantic import BaseModel
from typing import Optional, Any, Dict
from fastapi import HTTPException, Header

class InvestigationRequest(BaseModel):
    investigation_id: str
    cluster_context: Optional[str] = None

class AgentIngestRequest(BaseModel):
    cluster_context: str
    reason: str
    pod_name: str
    namespace: str
    evidence: Dict[str, Any]

@app.get("/clusters")
async def get_clusters():
    try:
        output = KubectlExecutor.run("kubectl config get-contexts -o name", parse_json=False)
        clusters = [line.strip() for line in output.split('\n') if line.strip()] if output else []
        return {"clusters": clusters}
    except KubectlError as e:
        logger.error(f"Failed to fetch clusters: {str(e)}")
        return {"clusters": []}


@app.get("/metrics")
async def get_cluster_metrics(context: Optional[str] = None):
    """
    Returns real-time cluster resource usage percentages.
    Requires metrics-server to be installed in the cluster.
    Falls back to node capacity-based estimates if top commands fail.
    """
    metrics = {
        "cpu_pct": 0,
        "memory_pct": 0,
        "disk_pct": 0,
        "network_pct": 0,
        "node_count": 0,
        "pod_count": 0,
    }

    try:
        # --- Node count ---
        nodes_json = KubectlExecutor.run(
            "kubectl get nodes -o json", parse_json=True, context=context
        )
        nodes = nodes_json.get("items", [])
        metrics["node_count"] = len(nodes)

        # --- Pod count ---
        pods_json = KubectlExecutor.run(
            "kubectl get pods -A --field-selector=status.phase=Running -o json",
            parse_json=True, context=context
        )
        metrics["pod_count"] = len(pods_json.get("items", []))

        # --- CPU & Memory via kubectl top nodes ---
        try:
            top_output = KubectlExecutor.run(
                "kubectl top nodes --no-headers", parse_json=False, context=context
            )
            # Format: NAME   CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
            cpu_pcts = []
            mem_pcts = []
            for line in top_output.strip().split("\n"):
                parts = line.split()
                if len(parts) >= 5:
                    cpu_str = parts[2].replace("%", "")
                    mem_str = parts[4].replace("%", "")
                    try:
                        cpu_pcts.append(int(cpu_str))
                        mem_pcts.append(int(mem_str))
                    except ValueError:
                        pass

            if cpu_pcts:
                metrics["cpu_pct"] = round(sum(cpu_pcts) / len(cpu_pcts))
            if mem_pcts:
                metrics["memory_pct"] = round(sum(mem_pcts) / len(mem_pcts))
        except KubectlError:
            # metrics-server not available — try to estimate from capacity/requests
            logger.warning("kubectl top nodes failed — metrics-server may not be installed")
            total_cpu_cap = 0
            total_cpu_req = 0
            total_mem_cap = 0
            total_mem_req = 0
            for node in nodes:
                cap = node.get("status", {}).get("capacity", {})
                alloc = node.get("status", {}).get("allocatable", {})
                # CPU in cores (string like "4" or "4000m")
                cpu_cap = cap.get("cpu", "0")
                cpu_alloc = alloc.get("cpu", cpu_cap)
                total_cpu_cap += _parse_cpu(cpu_cap)
                # Memory in bytes (string like "8Gi" or "8192Ki")
                mem_cap = cap.get("memory", "0")
                total_mem_cap += _parse_mem(mem_cap)

            # Sum pod requests across all pods
            for pod in pods_json.get("items", []):
                for container in pod.get("spec", {}).get("containers", []):
                    reqs = container.get("resources", {}).get("requests", {})
                    total_cpu_req += _parse_cpu(reqs.get("cpu", "0"))
                    total_mem_req += _parse_mem(reqs.get("memory", "0"))

            if total_cpu_cap > 0:
                metrics["cpu_pct"] = min(99, round((total_cpu_req / total_cpu_cap) * 100))
            if total_mem_cap > 0:
                metrics["memory_pct"] = min(99, round((total_mem_req / total_mem_cap) * 100))

        # --- Disk usage (from node conditions or df-style) ---
        try:
            # Check node conditions for DiskPressure
            disk_pressure_count = 0
            for node in nodes:
                conditions = node.get("status", {}).get("conditions", [])
                for cond in conditions:
                    if cond.get("type") == "DiskPressure" and cond.get("status") == "True":
                        disk_pressure_count += 1
            # Rough estimate: if any node has disk pressure, show high
            if disk_pressure_count > 0:
                metrics["disk_pct"] = 90
            else:
                # Estimate from ephemeral-storage allocation
                total_disk_cap = 0
                total_disk_used = 0
                for node in nodes:
                    cap = node.get("status", {}).get("capacity", {})
                    alloc = node.get("status", {}).get("allocatable", {})
                    disk_cap = _parse_mem(cap.get("ephemeral-storage", "0"))
                    disk_alloc = _parse_mem(alloc.get("ephemeral-storage", "0"))
                    total_disk_cap += disk_cap
                    if disk_cap > 0 and disk_alloc > 0:
                        total_disk_used += (disk_cap - disk_alloc)
                if total_disk_cap > 0:
                    metrics["disk_pct"] = min(99, round((total_disk_used / total_disk_cap) * 100))
                else:
                    metrics["disk_pct"] = 45  # fallback placeholder
        except Exception:
            metrics["disk_pct"] = 45

        # --- Network (no direct k8s metric — show pod density as proxy) ---
        if metrics["node_count"] > 0:
            pods_per_node = metrics["pod_count"] / metrics["node_count"]
            # Rough heuristic: 110 pods/node is max, scale to percentage
            metrics["network_pct"] = min(95, round((pods_per_node / 110) * 100))

    except ClusterUnreachableError:
        # Cluster is down — executor already logged a rate-limited warning. Return zeros quietly.
        pass
    except KubectlError as e:
        logger.error(f"Metrics collection failed: {e}")
        # Return zeros — frontend will show empty meters
    except Exception as e:
        logger.error(f"Unexpected metrics error: {e}")

    return metrics


def _parse_cpu(val: str) -> float:
    """Parse kubernetes CPU value (e.g. '500m', '2', '4000m') to cores."""
    if not val or val == "0":
        return 0
    val = val.strip()
    if val.endswith("m"):
        return float(val[:-1]) / 1000
    try:
        return float(val)
    except ValueError:
        return 0


def _parse_mem(val: str) -> float:
    """Parse kubernetes memory value (e.g. '8Gi', '512Mi', '1024Ki') to bytes."""
    if not val or val == "0":
        return 0
    val = val.strip()
    multipliers = {"Ki": 1024, "Mi": 1024**2, "Gi": 1024**3, "Ti": 1024**4, "K": 1000, "M": 1000**2, "G": 1000**3}
    for suffix, mult in multipliers.items():
        if val.endswith(suffix):
            try:
                return float(val[:-len(suffix)]) * mult
            except ValueError:
                return 0
    try:
        return float(val)
    except ValueError:
        return 0

@app.get("/investigate/{investigation_id}/progress")
async def get_investigation_progress(investigation_id: str, authorization: Optional[str] = Header(None)):
    """Fetches the progress steps for a specific investigation."""
    # We use the backend's admin client to bypass RLS since the frontend anon_key is blocked
    client = InsForgeClient()
    if not client.url:
        return {"progress": []}
        
    try:
        import httpx
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{client.base_url}/investigation_progress?session_id=eq.{investigation_id}&order=created_at.asc",
                headers=client.headers
            )
            resp.raise_for_status()
            data = resp.json()
            return {"progress": data}
    except Exception as e:
        logger.error(f"Failed to fetch progress for {investigation_id}: {e}")
        return {"progress": []}

def _user_id_from_jwt(authorization: Optional[str]) -> Optional[str]:
    """Best-effort extraction of the user id (sub claim) from a Bearer JWT."""
    if not authorization:
        return None
    token = authorization.split("Bearer ")[-1].strip()
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        import base64
        import json as _json
        payload = parts[1]
        payload += "=" * ((4 - len(payload) % 4) % 4)
        decoded = base64.b64decode(payload).decode("utf-8")
        return _json.loads(decoded).get("sub")
    except Exception:
        return None


@app.post("/investigate")
async def investigate_cluster(request: InvestigationRequest, authorization: Optional[str] = Header(None)):
    logger.info(f"Received request to investigate cluster (context: {request.cluster_context}).")

    # Initialize the client with the user's JWT so it passes RLS checks
    client = InsForgeClient(user_jwt=authorization)

    # The frontend sends a short optimistic id (e.g. "inv_ab12cd"). The database
    # keys investigations/investigation_progress by a real UUID, so we must create
    # a persistent investigation row here and use its UUID for all DB writes.
    user_id = _user_id_from_jwt(authorization)
    real_investigation_id = await client.create_investigation(
        cluster_context=request.cluster_context, user_id=user_id
    )
    # If persistence is unavailable, still run the investigation and return the
    # diagnosis in the response (progress steps simply won't be persisted).
    active_id = real_investigation_id or None

    try:
        # 1. Collect Evidence
        service = InvestigationService(client=client)
        investigation_data = await service.run_investigation(active_id, request.cluster_context)

        # 2. AI Reasoning
        ai_agent = KubernetesAIAgent()
        diagnosis = await ai_agent.analyze(investigation_data)

        # 3. Save Final Diagnosis
        if active_id:
            await client.complete_investigation(active_id, diagnosis)

        return {
            "status": "success",
            "investigation_id": active_id,
            "diagnosis": diagnosis
        }
    except KubectlError as e:
        logger.error(f"Investigation failed due to cluster error: {str(e)}")
        if active_id:
            failure_diagnosis = {
                "root_cause": str(e),
                "explanation": "The AI Agent could not communicate with the Kubernetes cluster.",
                "fix": "Please check your cluster connection, kubeconfig, and ensure the cluster is running.",
                "kubectl_command": None,
                "confidence": 0
            }
            await client.complete_investigation(active_id, failure_diagnosis)

        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected investigation error: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred during the investigation.")

async def process_incident_background(investigation_id: str, evidence: dict):
    """Background task to run AI reasoning without blocking the ingest HTTP response."""
    client = InsForgeClient()
    try:
        await client.update_progress(investigation_id, "AI Reasoning")
        ai_agent = KubernetesAIAgent()
        diagnosis = await ai_agent.analyze(evidence)
        await client.complete_investigation(investigation_id, diagnosis)
    except Exception as e:
        logger.error(f"Background AI processing failed: {e}")
        failure_diagnosis = {
            "root_cause": str(e),
            "explanation": "The AI Agent failed to process the evidence.",
            "fix": "Please check the backend logs for rate limits or errors.",
            "kubectl_command": None,
            "confidence": 0
        }
        await client.complete_investigation(investigation_id, failure_diagnosis)

@app.post("/api/v1/ingest")
async def ingest_incident(request: AgentIngestRequest, background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    """Receives incident evidence from the in-cluster push agent."""
    logger.info(f"Ingesting incident from agent for cluster: {request.cluster_context} (pod: {request.pod_name})")
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
    cluster_token = authorization.split("Bearer ")[1].strip()
    client = InsForgeClient()
    
    # 1. Validate the token against the clusters table
    user_id, cluster_name = await client.validate_cluster_token(cluster_token)
    if not user_id:
        logger.warning(f"Unauthorized cluster token: {cluster_token}")
        raise HTTPException(status_code=401, detail="Invalid cluster token")
        
    try:
        # 2. Create a new investigation in DB for this user
        investigation_id = await client.create_investigation(cluster_context=request.cluster_context, user_id=user_id)
        
        if not investigation_id:
            logger.error("Failed to create investigation in DB during ingestion.")
            raise HTTPException(status_code=500, detail="Database error")
            
        # 2. Queue AI Reasoning in background
        background_tasks.add_task(process_incident_background, investigation_id, request.evidence)
        
        # 3. Immediately return 200 OK so the agent is not blocked
        return {"status": "success", "investigation_id": investigation_id, "message": "Incident queued for AI analysis"}
    except Exception as e:
        logger.error(f"Unexpected error during ingestion: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred during ingestion.")


from pydantic import Field

class RestartPodParams(BaseModel):
    namespace: str
    pod_name: str

class RollbackDeploymentParams(BaseModel):
    namespace: str
    deployment_name: str
    target_revision: Optional[int] = None

class UpdateResourceLimitsParams(BaseModel):
    namespace: str
    deployment_name: str
    container_name: str
    memory_limit: Optional[str] = None
    cpu_limit: Optional[str] = None

class ScaleDeploymentParams(BaseModel):
    namespace: str
    deployment_name: str
    replicas: int = Field(ge=0, le=50)


class UpdateEnvironmentVariableParams(BaseModel):
    namespace: str
    deployment_name: str
    container_name: str
    env_name: str
    env_value: str

class ActionCreateRequest(BaseModel):
    investigation_id: str
    action_type: str
    params: Dict[str, Any]

@app.post("/api/v1/actions")
async def create_action(request: ActionCreateRequest, authorization: Optional[str] = Header(None)):
    """Frontend requests an action execution."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    # We validate the params depending on action_type
    try:
        if request.action_type == "restart_pod":
            RestartPodParams(**request.params)
        elif request.action_type == "rollback_deployment":
            RollbackDeploymentParams(**request.params)
        elif request.action_type == "update_resource_limits":
            UpdateResourceLimitsParams(**request.params)
        elif request.action_type == "scale_deployment":
            ScaleDeploymentParams(**request.params)
        elif request.action_type == "update_environment_variable":
            UpdateEnvironmentVariableParams(**request.params)
        else:
            raise HTTPException(status_code=400, detail="Invalid action_type")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid parameters: {e}")
        
    namespace = request.params.get("namespace", "")
    blocked_namespaces = ["kube-system", "kube-public", "kube-node-lease"]
    if namespace in blocked_namespaces:
        raise HTTPException(status_code=403, detail="Cannot execute actions in system namespaces")

    user_jwt = authorization.split("Bearer ")[1].strip()
    client = InsForgeClient(user_jwt=f"Bearer {user_jwt}")
    
    try:
        inv_details = await client.get_investigation_details(request.investigation_id)
        if not inv_details:
            raise HTTPException(status_code=404, detail="Investigation not found")

        user_id = inv_details.get("user_id")
        if not user_id:
            import base64
            import json
            parts = user_jwt.split(".")
            if len(parts) == 3:
                payload = parts[1]
                payload += "=" * ((4 - len(payload) % 4) % 4)
                decoded = base64.b64decode(payload).decode("utf-8")
                user_id = json.loads(decoded).get("sub")

        if not user_id:
            raise HTTPException(status_code=400, detail="Could not determine user_id for action")

        action = await client.create_action(
            request.investigation_id, 
            request.action_type, 
            request.params,
            user_id=user_id,
            cluster_name=inv_details["cluster_context"]
        )
        if not action:
            raise HTTPException(status_code=500, detail="Failed to create action (no action returned)")
        return action
    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e)
        if hasattr(e, 'response') and hasattr(e.response, 'text'):
            err_msg = f"{e} - {e.response.text}"
        raise HTTPException(status_code=500, detail=f"Failed to create action: {err_msg}")

@app.get("/api/v1/actions/pending")
async def get_pending_actions(authorization: Optional[str] = Header(None)):
    """Agent polls for pending actions to execute."""
    with open("agent_hits.log", "a") as f:
        f.write("Agent hit pending endpoint\n")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
    cluster_token = authorization.split("Bearer ")[1].strip()
    client = InsForgeClient()
    
    user_id, cluster_name = await client.validate_cluster_token(cluster_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid cluster token")
        
    actions = await client.get_pending_actions(user_id, cluster_name)
    return {"actions": actions}

class ActionResultRequest(BaseModel):
    status: str
    output: Dict[str, Any]

@app.post("/api/v1/actions/{action_id}/result")
async def update_action_result(action_id: str, request: ActionResultRequest, authorization: Optional[str] = Header(None)):
    """Agent posts the execution result of an action."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
    cluster_token = authorization.split("Bearer ")[1].strip()
    client = InsForgeClient()
    
    user_id, cluster_name = await client.validate_cluster_token(cluster_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid cluster token")
        
    success = await client.update_action_result(action_id, request.status, request.output)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update action result")
        
    return {"status": "success"}


# --- Metrics History (in-memory time-series for the chart) ---
import time
import asyncio
from datetime import datetime

_metrics_history: list[dict] = []  # stores last 30 samples
_MAX_HISTORY = 30


def _collect_metrics_sample_sync():
    """Collects a single metrics snapshot (runs in thread pool, not on event loop)."""
    try:
        sample = {
            "ts": datetime.utcnow().isoformat(),
            "cpu_pct": 0,
            "memory_pct": 0,
            "pod_count": 0,
        }
        # CPU + memory from kubectl top
        try:
            top_output = KubectlExecutor.run("kubectl top nodes --no-headers", parse_json=False)
            cpu_pcts = []
            mem_pcts = []
            for line in top_output.strip().split("\n"):
                parts = line.split()
                if len(parts) >= 5:
                    try:
                        cpu_pcts.append(int(parts[2].replace("%", "")))
                        mem_pcts.append(int(parts[4].replace("%", "")))
                    except ValueError:
                        pass
            if cpu_pcts:
                sample["cpu_pct"] = round(sum(cpu_pcts) / len(cpu_pcts))
            if mem_pcts:
                sample["memory_pct"] = round(sum(mem_pcts) / len(mem_pcts))
        except Exception:
            pass

        # Pod count
        try:
            pods_json = KubectlExecutor.run(
                "kubectl get pods -A --field-selector=status.phase=Running -o json", parse_json=True
            )
            sample["pod_count"] = len(pods_json.get("items", []))
        except Exception:
            pass

        _metrics_history.append(sample)
        if len(_metrics_history) > _MAX_HISTORY:
            _metrics_history.pop(0)

    except Exception as e:
        logger.error(f"Background metrics collection error: {e}")


async def _metrics_collector_loop():
    """Background loop that collects a sample every 10 seconds."""
    while True:
        # Run in thread pool so synchronous subprocess calls don't block the event loop
        await asyncio.to_thread(_collect_metrics_sample_sync)
        await asyncio.sleep(10)


@app.on_event("startup")
async def start_metrics_collector():
    asyncio.create_task(_metrics_collector_loop())


@app.get("/metrics/history")
async def get_metrics_history():
    """
    Returns the last 30 metrics samples (collected every ~10s).
    Each sample: { ts, cpu_pct, memory_pct, pod_count }
    """
    return {"samples": _metrics_history}





# ============================================================
# Additional real-data endpoints: Workloads, Nodes, Events, Ask
# ============================================================

@app.get("/workloads")
async def get_workloads(context: Optional[str] = None):
    """Returns real deployments in the cluster with pod/resource status."""
    try:
        deployments_json = KubectlExecutor.run(
            "kubectl get deployments -A -o json", parse_json=True, context=context
        )
        pods_json = KubectlExecutor.run(
            "kubectl get pods -A -o json", parse_json=True, context=context
        )
    except ClusterUnreachableError:
        return {"workloads": []}
    except KubectlError as e:
        logger.error(f"Failed to fetch workloads: {e}")
        return {"workloads": []}

    # Try to get live cpu/mem per pod (best-effort — needs metrics-server)
    pod_metrics: dict[str, dict] = {}
    try:
        top_output = KubectlExecutor.run("kubectl top pods -A --no-headers", parse_json=False, context=context)
        for line in top_output.strip().split("\n"):
            parts = line.split()
            if len(parts) >= 4:
                ns, name, cpu, mem = parts[0], parts[1], parts[2], parts[3]
                pod_metrics[f"{ns}/{name}"] = {
                    "cpu_m": round(_parse_cpu(cpu) * 1000),
                    "mem_mi": round(_parse_mem(mem) / (1024 ** 2)),
                }
    except Exception:
        pass  # metrics-server may not be installed

    all_pods = pods_json.get("items", [])
    workloads = []

    for dep in deployments_json.get("items", []):
        meta = dep.get("metadata", {})
        spec = dep.get("spec", {})
        status = dep.get("status", {})
        ns = meta.get("namespace", "default")
        name = meta.get("name", "unknown")
        desired = spec.get("replicas", 0) or 0
        ready = status.get("readyReplicas", 0) or 0
        match_labels = spec.get("selector", {}).get("matchLabels", {}) or {}

        # find pods belonging to this deployment (same namespace + labels superset)
        owned_pods = []
        for pod in all_pods:
            if pod.get("metadata", {}).get("namespace") != ns:
                continue
            pod_labels = pod.get("metadata", {}).get("labels", {}) or {}
            if match_labels and all(pod_labels.get(k) == v for k, v in match_labels.items()):
                owned_pods.append(pod)

        total_cpu_m = 0
        total_mem_mi = 0
        max_restarts = 0
        for pod in owned_pods:
            pname = pod.get("metadata", {}).get("name", "")
            key = f"{ns}/{pname}"
            if key in pod_metrics:
                total_cpu_m += pod_metrics[key]["cpu_m"]
                total_mem_mi += pod_metrics[key]["mem_mi"]
            for cs in pod.get("status", {}).get("containerStatuses", []):
                max_restarts = max(max_restarts, cs.get("restartCount", 0))

        if desired == 0:
            status_label = "Unknown"
        elif ready >= desired:
            status_label = "Healthy"
        elif ready > 0:
            status_label = "Degraded"
        else:
            status_label = "Down"

        if status_label == "Down" or max_restarts >= 5:
            risk = "high"
        elif status_label == "Degraded" or max_restarts >= 1:
            risk = "medium"
        else:
            risk = "safe"

        workloads.append({
            "name": name,
            "namespace": ns,
            "pods_ready": ready,
            "pods_desired": desired,
            "cpu_m": total_cpu_m,
            "mem_mi": total_mem_mi,
            "restarts": max_restarts,
            "status": status_label,
            "risk": risk,
        })

    return {"workloads": workloads}


@app.get("/pods")
async def get_pods(context: Optional[str] = None):
    """Returns a list of all pods with their status and metrics."""
    try:
        pods_json = KubectlExecutor.run("kubectl get pods -A -o json", parse_json=True, context=context)
        items = pods_json.get("items", [])
        
        # Try to get live cpu/mem per pod
        pod_metrics = {}
        try:
            top_output = KubectlExecutor.run("kubectl top pods -A --no-headers", parse_json=False, context=context)
            for line in top_output.strip().split("\n"):
                parts = line.split()
                if len(parts) >= 4:
                    ns, name, cpu, mem = parts[0], parts[1], parts[2], parts[3]
                    pod_metrics[f"{ns}/{name}"] = {
                        "cpu": cpu,
                        "mem": mem,
                    }
        except Exception:
            pass  # metrics-server may not be installed

        result = []
        for p in items:
            meta = p.get("metadata", {})
            status = p.get("status", {})
            ns = meta.get("namespace", "unknown")
            name = meta.get("name", "unknown")
            phase = status.get("phase", "Unknown")
            
            restarts = 0
            for cs in status.get("containerStatuses", []):
                restarts += cs.get("restartCount", 0)

            key = f"{ns}/{name}"
            cpu = pod_metrics.get(key, {}).get("cpu", "-")
            mem = pod_metrics.get(key, {}).get("mem", "-")

            result.append({
                "namespace": ns,
                "name": name,
                "status": phase,
                "restarts": restarts,
                "cpu": cpu,
                "memory": mem,
                "created_at": meta.get("creationTimestamp")
            })
            
        return {"pods": result}
    except ClusterUnreachableError:
        return {"pods": []}
    except Exception as e:
        logger.error(f"Failed to fetch pods: {e}")
        return {"pods": []}


@app.get("/nodes")
async def get_nodes(context: Optional[str] = None):
    """Returns real node-level status and resource usage."""
    try:
        nodes_json = KubectlExecutor.run("kubectl get nodes -o json", parse_json=True, context=context)
    except ClusterUnreachableError:
        return {"nodes": []}
    except KubectlError as e:
        logger.error(f"Failed to fetch nodes: {e}")
        return {"nodes": []}

    top_by_node: dict[str, dict] = {}
    try:
        top_output = KubectlExecutor.run("kubectl top nodes --no-headers", parse_json=False, context=context)
        for line in top_output.strip().split("\n"):
            parts = line.split()
            if len(parts) >= 5:
                try:
                    top_by_node[parts[0]] = {
                        "cpu_pct": int(parts[2].replace("%", "")),
                        "mem_pct": int(parts[4].replace("%", "")),
                    }
                except ValueError:
                    pass
    except Exception:
        pass

    nodes = []
    for node in nodes_json.get("items", []):
        meta = node.get("metadata", {})
        name = meta.get("name", "unknown")
        labels = meta.get("labels", {}) or {}
        roles = [k.split("/")[-1] for k in labels if k.startswith("node-role.kubernetes.io/")]
        conditions = node.get("status", {}).get("conditions", [])
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)
        capacity = node.get("status", {}).get("capacity", {})
        top = top_by_node.get(name, {"cpu_pct": 0, "mem_pct": 0})

        nodes.append({
            "name": name,
            "roles": roles or ["worker"],
            "status": "Ready" if ready else "NotReady",
            "cpu_pct": top["cpu_pct"],
            "mem_pct": top["mem_pct"],
            "cpu_capacity": capacity.get("cpu", "-"),
            "mem_capacity": capacity.get("memory", "-"),
            "created_at": meta.get("creationTimestamp"),
        })

    return {"nodes": nodes}


@app.get("/events")
async def get_events(context: Optional[str] = None, limit: int = 30):
    """Returns recent real Kubernetes events across all namespaces."""
    try:
        events_json = KubectlExecutor.run("kubectl get events -A -o json", parse_json=True, context=context)
    except ClusterUnreachableError:
        return {"events": []}
    except KubectlError as e:
        logger.error(f"Failed to fetch events: {e}")
        return {"events": []}

    items = events_json.get("items", [])

    def sort_key(ev):
        return ev.get("lastTimestamp") or ev.get("eventTime") or ev.get("metadata", {}).get("creationTimestamp") or ""

    items.sort(key=sort_key, reverse=True)

    events = []
    for ev in items[:limit]:
        involved = ev.get("involvedObject", {})
        events.append({
            "type": ev.get("type", "Normal"),
            "reason": ev.get("reason", ""),
            "message": ev.get("message", ""),
            "namespace": ev.get("metadata", {}).get("namespace", ""),
            "object_kind": involved.get("kind", ""),
            "object_name": involved.get("name", ""),
            "last_seen": sort_key(ev),
            "count": ev.get("count", 1),
        })

    return {"events": events}


class AskRequest(BaseModel):
    message: str
    cluster_context: Optional[str] = None
    image: Optional[str] = None  # data URL: "data:image/png;base64,...."


@app.post("/ask")
async def ask_kubric(request: AskRequest):
    """
    Conversational endpoint. Gathers a quick cluster snapshot and asks the LLM
    to answer, grounded in real state. Supports an optional image (screenshot,
    kubectl output, dashboard panel) for multimodal root-cause analysis.
    """
    from app.ai.llm import OpenRouterClient
    import json as _json

    snapshot_lines = []
    try:
        nodes_json = KubectlExecutor.run("kubectl get nodes -o json", parse_json=True, context=request.cluster_context)
        snapshot_lines.append(f"Nodes: {len(nodes_json.get('items', []))}")
    except Exception:
        snapshot_lines.append("Nodes: unavailable")

    try:
        pods_json = KubectlExecutor.run(
            "kubectl get pods -A --field-selector=status.phase=Running -o json",
            parse_json=True, context=request.cluster_context
        )
        snapshot_lines.append(f"Running pods: {len(pods_json.get('items', []))}")
    except Exception:
        snapshot_lines.append("Running pods: unavailable")

    try:
        events_json = KubectlExecutor.run("kubectl get events -A -o json", parse_json=True, context=request.cluster_context)
        warnings = [e for e in events_json.get("items", []) if e.get("type") == "Warning"]
        recent_warnings = warnings[-5:]
        if recent_warnings:
            snapshot_lines.append("Recent warning events:")
            for w in recent_warnings:
                snapshot_lines.append(f"  - {w.get('reason')}: {w.get('message')}")
        else:
            snapshot_lines.append("No recent warning events.")
    except Exception:
        pass

    snapshot = "\n".join(snapshot_lines)

    system_prompt = (
        "You are Kubric, an AI SRE assistant. Answer the user's question about their "
        "Kubernetes cluster concisely and factually, grounded in the provided live snapshot. "
        "If an image is attached (screenshot, kubectl output, error, or dashboard), analyse it "
        "and incorporate what you see. When you spot a problem, name the likely root cause and a "
        "concrete fix (including a kubectl command when relevant). "
        "Write in plain prose. Do NOT use markdown formatting of any kind: no '#' headings, "
        "no '###', no '**bold**', no bullet markers like '-' or '*'. If you need to separate "
        "sections, use a short label followed by a colon on its own line (e.g. 'Root cause:'). "
        "Use plain line breaks between ideas. "
        'Respond ONLY with JSON: {"reply": "<your answer as plain text with line breaks>"}'
    )

    text_block = f"Cluster snapshot:\n{snapshot}\n\nQuestion: {request.message}"

    # Build user content — multimodal if an image was provided
    if request.image:
        user_content: Any = [
            {"type": "text", "text": text_block},
            {"type": "image_url", "image_url": {"url": request.image}},
        ]
    else:
        user_content = text_block

    llm = OpenRouterClient()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    response_text = await llm.call_llm(messages)
    if not response_text:
        return {"reply": "I couldn't reach the AI service. Check that OPENROUTER_API_KEY is configured and the model supports vision if you attached an image."}

    try:
        parsed = _json.loads(response_text.strip().strip("`").replace("json\n", "", 1))
        return {"reply": parsed.get("reply", response_text)}
    except Exception:
        return {"reply": response_text}
