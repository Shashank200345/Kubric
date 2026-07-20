"""
Cluster state collector for the push architecture.

The in-cluster agent periodically builds a full snapshot of the cluster
(pods, nodes, workloads, events, metrics) plus recent logs for unhealthy pods,
and pushes it to the backend's POST /api/v1/state endpoint. The dashboard read
endpoints then serve from this snapshot instead of the backend running kubectl.

Output shapes intentionally match the backend's local-kubectl responses so the
frontend renders identically in either mode.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List
from loguru import logger
from kubernetes import client

_BAD_WAITING_REASONS = {
    "ImagePullBackOff", "ErrImagePull", "CrashLoopBackOff",
    "CreateContainerConfigError", "InvalidImageName",
}
_UNHEALTHY_POD_STATES = {
    "CrashLoopBackOff", "ImagePullBackOff", "Pending", "Error",
    "OOMKilled", "ContainerCreating",
}


def _parse_cpu_to_millicores(val: str) -> int:
    if not val:
        return 0
    val = str(val).strip()
    try:
        if val.endswith("n"):
            return int(int(val[:-1]) / 1_000_000)
        if val.endswith("u"):
            return int(int(val[:-1]) / 1000)
        if val.endswith("m"):
            return int(val[:-1])
        return int(float(val) * 1000)
    except ValueError:
        return 0


def _parse_mem_to_mi(val: str) -> int:
    if not val:
        return 0
    val = str(val).strip()
    units = {"Ki": 1 / 1024, "Mi": 1, "Gi": 1024, "Ti": 1024 * 1024,
             "K": 1000 / (1024 * 1024), "M": 1000 * 1000 / (1024 * 1024)}
    for suffix, mult in units.items():
        if val.endswith(suffix):
            try:
                return int(float(val[:-len(suffix)]) * mult)
            except ValueError:
                return 0
    try:
        return int(int(val) / (1024 * 1024))
    except ValueError:
        return 0


class StateCollector:
    def __init__(self, core_v1: client.CoreV1Api, apps_v1: client.AppsV1Api):
        self.v1 = core_v1
        self.apps_v1 = apps_v1

    def _pod_top(self) -> Dict[str, Dict[str, str]]:
        """Best-effort per-pod cpu/mem from metrics.k8s.io. Empty if unavailable."""
        out: Dict[str, Dict[str, str]] = {}
        try:
            metrics = client.CustomObjectsApi().list_cluster_custom_object(
                "metrics.k8s.io", "v1beta1", "pods"
            )
            for item in metrics.get("items", []):
                ns = item.get("metadata", {}).get("namespace", "")
                name = item.get("metadata", {}).get("name", "")
                cpu_m = 0
                mem_mi = 0
                for c in item.get("containers", []):
                    usage = c.get("usage", {})
                    cpu_m += _parse_cpu_to_millicores(usage.get("cpu", "0"))
                    mem_mi += _parse_mem_to_mi(usage.get("memory", "0"))
                out[f"{ns}/{name}"] = {"cpu": f"{cpu_m}m", "mem": f"{mem_mi}Mi",
                                       "cpu_m": cpu_m, "mem_mi": mem_mi}
        except Exception:
            pass
        return out

    def _node_top(self) -> Dict[str, Dict[str, int]]:
        out: Dict[str, Dict[str, int]] = {}
        try:
            metrics = client.CustomObjectsApi().list_cluster_custom_object(
                "metrics.k8s.io", "v1beta1", "nodes"
            )
            for item in metrics.get("items", []):
                name = item.get("metadata", {}).get("name", "")
                usage = item.get("usage", {})
                out[name] = {
                    "cpu_m": _parse_cpu_to_millicores(usage.get("cpu", "0")),
                    "mem_mi": _parse_mem_to_mi(usage.get("memory", "0")),
                }
        except Exception:
            pass
        return out

    def collect(self) -> Dict[str, Any]:
        pods = self.v1.list_pod_for_all_namespaces()
        nodes = self.v1.list_node()
        deployments = self.apps_v1.list_deployment_for_all_namespaces()
        try:
            events = self.v1.list_event_for_all_namespaces()
            event_items = events.items
        except Exception:
            event_items = []

        pod_top = self._pod_top()
        node_top = self._node_top()

        pod_rows = self._build_pods(pods, pod_top)
        node_rows, node_cap = self._build_nodes(nodes, node_top)
        workload_rows = self._build_workloads(deployments, pods, pod_top)
        event_rows = self._build_events(event_items)
        metrics = self._build_metrics(pods, nodes, node_top, node_cap)
        logs = self._collect_unhealthy_logs(pods)

        return {
            "pods": pod_rows,
            "nodes": node_rows,
            "workloads": workload_rows,
            "events": event_rows,
            "metrics": metrics,
            "logs": logs,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    def _build_pods(self, pods, pod_top) -> List[dict]:
        rows = []
        for p in pods.items:
            ns = p.metadata.namespace
            name = p.metadata.name
            phase = p.status.phase or "Unknown"
            restarts = 0
            for cs in (p.status.container_statuses or []):
                restarts += cs.restart_count or 0
            key = f"{ns}/{name}"
            top = pod_top.get(key, {})
            rows.append({
                "namespace": ns, "name": name, "status": phase,
                "restarts": restarts,
                "cpu": top.get("cpu", "-"), "memory": top.get("mem", "-"),
                "created_at": p.metadata.creation_timestamp.isoformat() if p.metadata.creation_timestamp else None,
            })
        return rows

    def _build_nodes(self, nodes, node_top):
        rows = []
        cap_totals = {"cpu_m": 0, "mem_mi": 0}
        for n in nodes.items:
            name = n.metadata.name
            labels = n.metadata.labels or {}
            roles = [k.split("/")[-1] for k in labels if k.startswith("node-role.kubernetes.io/")]
            conditions = n.status.conditions or []
            ready = any(c.type == "Ready" and c.status == "True" for c in conditions)
            cap = n.status.capacity or {}
            cpu_cap_m = _parse_cpu_to_millicores(cap.get("cpu", "0"))
            mem_cap_mi = _parse_mem_to_mi(cap.get("memory", "0"))
            cap_totals["cpu_m"] += cpu_cap_m
            cap_totals["mem_mi"] += mem_cap_mi
            top = node_top.get(name, {})
            cpu_pct = round((top.get("cpu_m", 0) / cpu_cap_m) * 100) if cpu_cap_m else 0
            mem_pct = round((top.get("mem_mi", 0) / mem_cap_mi) * 100) if mem_cap_mi else 0
            rows.append({
                "name": name, "roles": roles,
                "status": "Ready" if ready else "NotReady",
                "cpu_pct": cpu_pct, "mem_pct": mem_pct,
                "cpu_capacity": str(cap.get("cpu", "0")),
                "mem_capacity": f"{round(mem_cap_mi / 1024)}Gi" if mem_cap_mi else "0",
                "created_at": n.metadata.creation_timestamp.isoformat() if n.metadata.creation_timestamp else None,
            })
        return rows, cap_totals

    def _build_workloads(self, deployments, pods, pod_top) -> List[dict]:
        all_pods = pods.items
        rows = []
        for dep in deployments.items:
            ns = dep.metadata.namespace
            name = dep.metadata.name
            desired = dep.spec.replicas or 0
            ready = (dep.status.ready_replicas or 0) if dep.status else 0
            unavailable = (dep.status.unavailable_replicas or 0) if dep.status else 0
            match_labels = (dep.spec.selector.match_labels or {}) if dep.spec.selector else {}

            total_cpu_m = 0
            total_mem_mi = 0
            max_restarts = 0
            has_broken = False
            for pod in all_pods:
                if pod.metadata.namespace != ns:
                    continue
                pod_labels = pod.metadata.labels or {}
                if not match_labels or not all(pod_labels.get(k) == v for k, v in match_labels.items()):
                    continue
                key = f"{ns}/{pod.metadata.name}"
                top = pod_top.get(key, {})
                total_cpu_m += top.get("cpu_m", 0)
                total_mem_mi += top.get("mem_mi", 0)
                for cs in (pod.status.container_statuses or []):
                    max_restarts = max(max_restarts, cs.restart_count or 0)
                    waiting = cs.state.waiting if cs.state else None
                    if waiting and waiting.reason in _BAD_WAITING_REASONS:
                        has_broken = True

            rollout_stuck = has_broken or unavailable > 0
            if desired == 0:
                status = "Unknown"
            elif ready == 0:
                status = "Down"
            elif ready < desired or rollout_stuck:
                status = "Degraded"
            else:
                status = "Healthy"

            if status == "Down" or max_restarts >= 5 or has_broken:
                risk = "high"
            elif status == "Degraded" or max_restarts >= 1:
                risk = "medium"
            else:
                risk = "safe"

            rows.append({
                "name": name, "namespace": ns,
                "pods_ready": ready, "pods_desired": desired,
                "cpu_m": total_cpu_m, "mem_mi": total_mem_mi,
                "restarts": max_restarts, "status": status, "risk": risk,
            })
        return rows

    def _build_events(self, event_items) -> List[dict]:
        rows = []
        for e in event_items:
            involved = e.involved_object
            last = e.last_timestamp or e.event_time
            rows.append({
                "type": e.type or "Normal",
                "reason": e.reason or "",
                "message": e.message or "",
                "namespace": e.metadata.namespace if e.metadata else "",
                "object_kind": involved.kind if involved else "",
                "object_name": involved.name if involved else "",
                "last_seen": last.isoformat() if last else "",
                "count": e.count or 1,
            })
        return rows

    def _build_metrics(self, pods, nodes, node_top, node_cap) -> Dict[str, Any]:
        node_count = len(nodes.items)
        pod_count = sum(1 for p in pods.items if (p.status.phase == "Running"))
        total_cpu_used = sum(t.get("cpu_m", 0) for t in node_top.values())
        total_mem_used = sum(t.get("mem_mi", 0) for t in node_top.values())
        cpu_pct = round((total_cpu_used / node_cap["cpu_m"]) * 100) if node_cap["cpu_m"] else 0
        mem_pct = round((total_mem_used / node_cap["mem_mi"]) * 100) if node_cap["mem_mi"] else 0
        network_pct = 0
        if node_count:
            network_pct = min(95, round((pod_count / node_count / 110) * 100))
        return {
            "cpu_pct": min(99, cpu_pct),
            "memory_pct": min(99, mem_pct),
            "disk_pct": 0,
            "network_pct": network_pct,
            "node_count": node_count,
            "pod_count": pod_count,
        }

    def _collect_unhealthy_logs(self, pods) -> Dict[str, str]:
        """
        Collect recent logs (tail 50 lines) for unhealthy pods so agent-mode
        diagnosis has the same root-cause richness as local mode.
        """
        logs: Dict[str, str] = {}
        for pod in pods.items:
            ns = pod.metadata.namespace
            name = pod.metadata.name
            phase = pod.status.phase or "Unknown"
            is_unhealthy = phase in ("Failed", "Pending", "Unknown")

            if not is_unhealthy:
                for cs in (pod.status.container_statuses or []):
                    state = cs.state
                    waiting_reason = state.waiting.reason if (state and state.waiting) else ""
                    terminated_reason = state.terminated.reason if (state and state.terminated) else ""
                    if waiting_reason in _UNHEALTHY_POD_STATES or terminated_reason in _UNHEALTHY_POD_STATES:
                        is_unhealthy = True
                        break
                    if (cs.restart_count or 0) >= 2:
                        is_unhealthy = True
                        break

            if not is_unhealthy:
                continue

            key = f"{ns}/{name}"
            try:
                log_text = self.v1.read_namespaced_pod_log(
                    name=name, namespace=ns, tail_lines=50
                )
                if not log_text:
                    try:
                        log_text = self.v1.read_namespaced_pod_log(
                            name=name, namespace=ns, tail_lines=50, previous=True
                        )
                    except Exception:
                        log_text = "No logs available."
                logs[key] = log_text or "No logs available."
            except Exception:
                try:
                    log_text = self.v1.read_namespaced_pod_log(
                        name=name, namespace=ns, tail_lines=50, previous=True
                    )
                    logs[key] = log_text or "No logs available."
                except Exception:
                    logs[key] = "Could not fetch logs."

        return logs
