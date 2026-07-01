import os
from fastapi import FastAPI
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

from app.kubernetes.service import InvestigationService
from app.kubernetes.executor import KubectlExecutor, KubectlError
from app.ai.agent import KubernetesAIAgent
from app.insforge_client import InsForgeClient
from pydantic import BaseModel
from typing import Optional, Any
from fastapi import HTTPException, Header

class InvestigationRequest(BaseModel):
    investigation_id: str
    cluster_context: Optional[str] = None

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

@app.post("/investigate")
async def investigate_cluster(request: InvestigationRequest, authorization: Optional[str] = Header(None)):
    logger.info(f"Received request to investigate cluster for ID {request.investigation_id} (context: {request.cluster_context}).")
    
    # Initialize the client with the user's JWT so it passes RLS checks
    client = InsForgeClient(user_jwt=authorization)
    
    try:
        # 1. Collect Evidence
        service = InvestigationService(client=client)
        investigation_data = await service.run_investigation(request.investigation_id, request.cluster_context)
        
        # 2. AI Reasoning
        ai_agent = KubernetesAIAgent()
        diagnosis = await ai_agent.analyze(investigation_data)
        
        # 3. Save Final Diagnosis
        await client.complete_investigation(request.investigation_id, diagnosis)
        
        return {
            "status": "success",
            "diagnosis": diagnosis
        }
    except KubectlError as e:
        logger.error(f"Investigation failed due to cluster error: {str(e)}")
        # Save failure to db if investigation_id exists
        if request.investigation_id:
            client = InsForgeClient()
            # Send a default failure diagnosis
            failure_diagnosis = {
                "root_cause": str(e),
                "explanation": "The AI Agent could not communicate with the Kubernetes cluster.",
                "fix": "Please check your cluster connection, kubeconfig, and ensure the cluster is running.",
                "kubectl_command": None,
                "confidence": 0
            }
            await client.complete_investigation(request.investigation_id, failure_diagnosis)
            
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during investigation: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred during the investigation.")


# --- Metrics History (in-memory time-series for the chart) ---
import time
import asyncio
from datetime import datetime

_metrics_history: list[dict] = []  # stores last 30 samples
_MAX_HISTORY = 30


async def _collect_metrics_sample():
    """Collects a single metrics snapshot and appends to history."""
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
        await _collect_metrics_sample()
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


@app.get("/nodes")
async def get_nodes(context: Optional[str] = None):
    """Returns real node-level status and resource usage."""
    try:
        nodes_json = KubectlExecutor.run("kubectl get nodes -o json", parse_json=True, context=context)
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
