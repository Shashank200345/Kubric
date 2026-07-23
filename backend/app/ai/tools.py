"""
Read-only investigation tools for the ReAct diagnosis loop.

The LLM is given these tools and decides which to call to gather exactly the
evidence it needs (multi-hop root-cause), instead of receiving one fixed bundle.

Two backends implement the same interface so the loop works in both modes:
  - LiveKubectlTools:  KUBRIC_DATA_SOURCE=local  -> queries the cluster via kubectl
  - SnapshotTools:     KUBRIC_DATA_SOURCE=agent  -> reads the agent-pushed snapshot

Every tool is READ-ONLY. Nothing here can mutate the cluster.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Protocol

from loguru import logger

from app.kubernetes.executor import KubectlExecutor, KubectlError

# Caps to keep tool outputs (and therefore token usage) bounded.
_MAX_ITEMS = 60
_MAX_LOG_CHARS = 4000
_MAX_STR = 6000


def _truncate(text: str, limit: int = _MAX_STR) -> str:
    if text and len(text) > limit:
        return text[:limit] + f"\n…[truncated {len(text) - limit} chars]"
    return text


# --------------------------------------------------------------------------- #
# Tool schemas (OpenAI / OpenRouter function-calling format)
# --------------------------------------------------------------------------- #
TOOL_SCHEMAS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_pods",
            "description": "List pods with status and restart counts. Use only_unhealthy=true to focus on failing pods.",
            "parameters": {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string", "description": "Namespace to scope to; omit for all namespaces."},
                    "only_unhealthy": {"type": "boolean", "description": "Only return pods that are not Running/Ready."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "describe_pod",
            "description": "Detailed state for one pod: container specs (image, command, args, resources), container statuses, exit codes, restart reasons, and conditions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string"},
                    "name": {"type": "string"},
                },
                "required": ["namespace", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pod_logs",
            "description": "Recent logs for a pod. Set previous=true to read the logs of the last crashed container instance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string"},
                    "name": {"type": "string"},
                    "previous": {"type": "boolean"},
                    "tail_lines": {"type": "integer", "description": "Number of trailing lines (default 60)."},
                },
                "required": ["namespace", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_events",
            "description": "Recent Kubernetes events (Warnings first). Filter by namespace and/or a substring of the involved object name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "namespace": {"type": "string"},
                    "name_contains": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_deployments",
            "description": "List deployments with desired/ready replica counts and rollout status.",
            "parameters": {
                "type": "object",
                "properties": {"namespace": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_nodes",
            "description": "List nodes with readiness, roles, and resource capacity.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

_UNHEALTHY = {
    "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "Pending",
    "Error", "OOMKilled", "ContainerCreating", "Failed", "Unknown",
}


class ClusterReadTools(Protocol):
    async def list_pods(self, namespace: Optional[str] = None, only_unhealthy: bool = False) -> Any: ...
    async def describe_pod(self, namespace: str, name: str) -> Any: ...
    async def get_pod_logs(self, namespace: str, name: str, previous: bool = False, tail_lines: int = 60) -> Any: ...
    async def list_events(self, namespace: Optional[str] = None, name_contains: Optional[str] = None) -> Any: ...
    async def list_deployments(self, namespace: Optional[str] = None) -> Any: ...
    async def list_nodes(self) -> Any: ...


# --------------------------------------------------------------------------- #
# Live kubectl backend (local mode)
# --------------------------------------------------------------------------- #
class LiveKubectlTools:
    def __init__(self, context: Optional[str] = None):
        self.context = context

    def _ns_flag(self, namespace: Optional[str]) -> str:
        return f"-n {namespace}" if namespace else "-A"

    async def list_pods(self, namespace: Optional[str] = None, only_unhealthy: bool = False) -> Any:
        try:
            data = KubectlExecutor.run(f"kubectl get pods {self._ns_flag(namespace)} -o json", parse_json=True, context=self.context)
        except KubectlError as e:
            return {"error": str(e)}
        rows = []
        for it in (data.get("items") or []):
            meta, status = it.get("metadata", {}), it.get("status", {})
            phase = status.get("phase", "Unknown")
            restarts = sum((cs.get("restartCount", 0) for cs in status.get("containerStatuses", []) or []))
            reasons = []
            for cs in status.get("containerStatuses", []) or []:
                st = cs.get("state", {})
                if st.get("waiting"):
                    reasons.append(st["waiting"].get("reason", ""))
                if st.get("terminated"):
                    reasons.append(st["terminated"].get("reason", ""))
            unhealthy = phase not in ("Running", "Succeeded") or any(r in _UNHEALTHY for r in reasons) or restarts > 0
            if only_unhealthy and not unhealthy:
                continue
            rows.append({
                "namespace": meta.get("namespace"), "name": meta.get("name"),
                "phase": phase, "restarts": restarts,
                "reasons": [r for r in reasons if r], "node": it.get("spec", {}).get("nodeName"),
            })
        return {"pods": rows[:_MAX_ITEMS], "count": len(rows)}

    async def describe_pod(self, namespace: str, name: str) -> Any:
        try:
            it = KubectlExecutor.run(f"kubectl get pod {name} -n {namespace} -o json", parse_json=True, context=self.context)
        except KubectlError as e:
            return {"error": str(e)}
        spec, status = it.get("spec", {}), it.get("status", {})
        containers = [{
            "name": c.get("name"), "image": c.get("image"),
            "command": c.get("command"), "args": c.get("args"),
            "resources": c.get("resources"), "env": [e.get("name") for e in (c.get("env") or [])],
        } for c in spec.get("containers", [])]
        cstatuses = []
        for cs in status.get("containerStatuses", []) or []:
            state, last = cs.get("state", {}), cs.get("lastState", {})
            cstatuses.append({
                "name": cs.get("name"), "restartCount": cs.get("restartCount"),
                "state": state,
                "lastTerminated": last.get("terminated"),
            })
        return {
            "namespace": namespace, "name": name, "phase": status.get("phase"),
            "containers": containers, "containerStatuses": cstatuses,
            "conditions": [{"type": c.get("type"), "status": c.get("status"), "reason": c.get("reason")} for c in status.get("conditions", []) or []],
        }

    async def get_pod_logs(self, namespace: str, name: str, previous: bool = False, tail_lines: int = 60) -> Any:
        prev = " --previous" if previous else ""
        try:
            out = KubectlExecutor.run(f"kubectl logs {name} -n {namespace} --tail={tail_lines}{prev}", parse_json=False, context=self.context)
        except KubectlError as e:
            return {"error": str(e)}
        return {"logs": _truncate(out or "(no logs)", _MAX_LOG_CHARS)}

    async def list_events(self, namespace: Optional[str] = None, name_contains: Optional[str] = None) -> Any:
        try:
            data = KubectlExecutor.run(f"kubectl get events {self._ns_flag(namespace)} -o json", parse_json=True, context=self.context)
        except KubectlError as e:
            return {"error": str(e)}
        rows = []
        for e in (data.get("items") or []):
            obj = e.get("involvedObject", {})
            if name_contains and name_contains.lower() not in (obj.get("name", "").lower()):
                continue
            rows.append({
                "type": e.get("type"), "reason": e.get("reason"), "message": e.get("message"),
                "object": f"{obj.get('kind')}/{obj.get('name')}", "namespace": obj.get("namespace"),
                "count": e.get("count", 1),
            })
        rows.sort(key=lambda r: 0 if r["type"] == "Warning" else 1)
        return {"events": rows[:_MAX_ITEMS], "count": len(rows)}

    async def list_deployments(self, namespace: Optional[str] = None) -> Any:
        try:
            data = KubectlExecutor.run(f"kubectl get deploy {self._ns_flag(namespace)} -o json", parse_json=True, context=self.context)
        except KubectlError as e:
            return {"error": str(e)}
        rows = []
        for d in (data.get("items") or []):
            meta, spec, st = d.get("metadata", {}), d.get("spec", {}), d.get("status", {})
            rows.append({
                "name": meta.get("name"), "namespace": meta.get("namespace"),
                "desired": spec.get("replicas"), "ready": st.get("readyReplicas", 0),
                "available": st.get("availableReplicas", 0), "unavailable": st.get("unavailableReplicas", 0),
            })
        return {"deployments": rows[:_MAX_ITEMS], "count": len(rows)}

    async def list_nodes(self) -> Any:
        try:
            data = KubectlExecutor.run("kubectl get nodes -o json", parse_json=True, context=self.context)
        except KubectlError as e:
            return {"error": str(e)}
        rows = []
        for n in (data.get("items") or []):
            meta, status = n.get("metadata", {}), n.get("status", {})
            ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in status.get("conditions", []) or [])
            rows.append({
                "name": meta.get("name"), "ready": ready,
                "capacity": status.get("capacity", {}),
                "taints": [t.get("key") for t in n.get("spec", {}).get("taints", []) or []],
            })
        return {"nodes": rows[:_MAX_ITEMS], "count": len(rows)}


# --------------------------------------------------------------------------- #
# Snapshot backend (agent / push mode)
# --------------------------------------------------------------------------- #
class SnapshotTools:
    """Serves the same tools from the agent-pushed snapshot (no live cluster access)."""

    def __init__(self, snapshot: Dict[str, Any]):
        self.snap = snapshot or {}

    async def list_pods(self, namespace: Optional[str] = None, only_unhealthy: bool = False) -> Any:
        rows = []
        for p in (self.snap.get("pods") or []):
            if namespace and p.get("namespace") != namespace:
                continue
            status = str(p.get("status", ""))
            unhealthy = status in _UNHEALTHY or (p.get("restarts") or 0) > 0
            if only_unhealthy and not unhealthy:
                continue
            rows.append({"namespace": p.get("namespace"), "name": p.get("name"),
                         "phase": status, "restarts": p.get("restarts", 0)})
        return {"pods": rows[:_MAX_ITEMS], "count": len(rows)}

    async def describe_pod(self, namespace: str, name: str) -> Any:
        for p in (self.snap.get("pods") or []):
            if p.get("namespace") == namespace and p.get("name") == name:
                return {**p, "note": "Snapshot mode: container spec/exit codes are limited. Use get_pod_logs and list_events for more detail."}
        return {"error": f"pod {namespace}/{name} not found in the latest snapshot"}

    async def get_pod_logs(self, namespace: str, name: str, previous: bool = False, tail_lines: int = 60) -> Any:
        logs = self.snap.get("logs") or {}
        text = logs.get(f"{namespace}/{name}")
        if not text:
            return {"logs": "(no logs captured in snapshot for this pod)"}
        return {"logs": _truncate(text, _MAX_LOG_CHARS)}

    async def list_events(self, namespace: Optional[str] = None, name_contains: Optional[str] = None) -> Any:
        rows = []
        for e in (self.snap.get("events") or []):
            if namespace and e.get("namespace") != namespace:
                continue
            if name_contains and name_contains.lower() not in (e.get("object_name", "").lower()):
                continue
            rows.append({
                "type": e.get("type"), "reason": e.get("reason"), "message": e.get("message"),
                "object": f"{e.get('object_kind')}/{e.get('object_name')}",
                "namespace": e.get("namespace"), "count": e.get("count", 1),
            })
        rows.sort(key=lambda r: 0 if r["type"] == "Warning" else 1)
        return {"events": rows[:_MAX_ITEMS], "count": len(rows)}

    async def list_deployments(self, namespace: Optional[str] = None) -> Any:
        rows = []
        for w in (self.snap.get("workloads") or []):
            if namespace and w.get("namespace") != namespace:
                continue
            rows.append({
                "name": w.get("name"), "namespace": w.get("namespace"),
                "desired": w.get("pods_desired"), "ready": w.get("pods_ready"),
                "status": w.get("status"), "restarts": w.get("restarts"),
            })
        return {"deployments": rows[:_MAX_ITEMS], "count": len(rows)}

    async def list_nodes(self) -> Any:
        return {"nodes": (self.snap.get("nodes") or [])[:_MAX_ITEMS], "count": len(self.snap.get("nodes") or [])}


async def execute_tool(provider: ClusterReadTools, name: str, args: Dict[str, Any]) -> str:
    """Dispatch a tool call to the provider and return a JSON string result."""
    try:
        fn = getattr(provider, name, None)
        if fn is None:
            return json.dumps({"error": f"unknown tool '{name}'"})
        result = await fn(**(args or {}))
        return _truncate(json.dumps(result, default=str))
    except TypeError as e:
        return json.dumps({"error": f"bad arguments for {name}: {e}"})
    except Exception as e:  # never let a tool crash the loop
        logger.error(f"[react] tool {name} failed: {e}")
        return json.dumps({"error": f"tool {name} failed: {e}"})
