'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface ClusterEvent {
  type: string;
  reason: string;
  message: string;
  namespace: string;
  object_kind: string;
  object_name: string;
  last_seen: string;
  count: number;
}

interface Workload {
  name: string;
  namespace: string;
  pods_ready: number;
  pods_desired: number;
  restarts: number;
  status: string;
  risk: string;
}

interface Incident {
  id: string;
  severity: 'critical' | 'warning';
  crashType: string;      // raw k8s reason, e.g. ImagePullBackOff
  title: string;          // plain-English headline
  why: string;            // plain-English explanation
  fix: string;            // plain-English fix
  cmd?: string;           // kubectl to investigate/fix
  namespace: string;
  podName: string;
  kind: string;
  count: number;
  lastSeen: string;
  rawMessage: string;
  source: 'workload' | 'event';
}

// Plain-English translations for common Kubernetes failure reasons.
// The incident DATA is always live — this only makes the reason readable.
type Friendly = { title: string; why: string; fix: string; cmd?: string; glyph: string };
const FRIENDLY: Record<string, Friendly> = {
  OOMKilled: {
    title: 'Ran out of memory', glyph: 'M',
    why: 'The container used more memory than its limit, so the node killed it.',
    fix: 'Raise the memory limit for this workload, or fix the memory leak.',
    cmd: 'kubectl set resources deploy/<name> --limits=memory=512Mi',
  },
  CrashLoopBackOff: {
    title: 'Keeps crashing on startup', glyph: '↻',
    why: 'The app exits with an error right after starting, so Kubernetes keeps restarting it in a loop.',
    fix: 'Read the previous container logs to find the startup error, then fix the config or image.',
    cmd: 'kubectl logs <pod> --previous',
  },
  BackOff: {
    title: 'Restarting repeatedly', glyph: '↻',
    why: 'Kubernetes is backing off because the container keeps failing to start.',
    fix: 'Check the container command, image, and startup logs.',
    cmd: 'kubectl logs <pod> --previous',
  },
  ImagePullBackOff: {
    title: "Can't download the image", glyph: '⤓',
    why: "Kubernetes can't pull the container image — the tag probably doesn't exist or the registry needs credentials.",
    fix: 'Verify the image name and tag exist, and that pull secrets are set.',
    cmd: 'kubectl describe pod <pod>',
  },
  ErrImagePull: {
    title: "Can't download the image", glyph: '⤓',
    why: 'The image pull failed — wrong tag, missing image, or an auth error.',
    fix: 'Confirm the image reference and registry credentials.',
    cmd: 'kubectl describe pod <pod>',
  },
  FailedScheduling: {
    title: "Can't be placed on any node", glyph: '◈',
    why: "No node has enough free resources or matches this pod's placement rules.",
    fix: "Lower the pod's requests, adjust taints/affinity, or add node capacity.",
    cmd: 'kubectl describe pod <pod>',
  },
  Unhealthy: {
    title: 'Health check is failing', glyph: '♥',
    why: "A liveness or readiness probe isn't passing, so Kubernetes holds traffic back or restarts the pod.",
    fix: 'Check the probe path/port and the app health endpoint.',
    cmd: 'kubectl describe pod <pod>',
  },
  FailedMount: {
    title: 'Storage failed to attach', glyph: '⧉',
    why: 'A volume or secret could not be mounted into the pod.',
    fix: 'Confirm the PVC/secret exists and is bound in this namespace.',
    cmd: 'kubectl describe pod <pod>',
  },
  Evicted: {
    title: 'Evicted for resource pressure', glyph: '⇥',
    why: 'The node ran low on memory or disk and evicted this pod to recover.',
    fix: 'Free node resources or add capacity, then reschedule the pod.',
    cmd: 'kubectl describe node <node>',
  },
  Failed: {
    title: 'Reported a failure', glyph: '✕',
    why: 'The pod or job entered a failed state.',
    fix: 'Inspect the pod events and logs for the underlying error.',
    cmd: 'kubectl describe pod <pod>',
  },
};

const CRITICAL_REASONS = new Set(['OOMKilled', 'CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'Failed', 'Evicted']);

function friendlyFor(reason: string): Friendly {
  return FRIENDLY[reason] || {
    title: reason || 'Cluster warning', glyph: '!',
    why: 'Kubernetes reported a warning for this object.',
    fix: 'Open the object details to inspect the event.',
    cmd: 'kubectl describe pod <pod>',
  };
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function IncidentsScreen({ selectedCluster }: { selectedCluster: string }) {
  const cluster = selectedCluster || 'current cluster';
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  const load = useCallback(async () => {
    const ctx = selectedCluster ? `?context=${encodeURIComponent(selectedCluster)}` : '';
    try {
      const [evRes, wlRes] = await Promise.all([
        fetch(`${API_BASE}/events${ctx}${ctx ? '&' : '?'}limit=60`),
        fetch(`${API_BASE}/workloads${ctx}`),
      ]);
      if (!evRes.ok || !wlRes.ok) { setReachable(false); setLoading(false); return; }
      const evData = await evRes.json();
      const wlData = await wlRes.json();
      setReachable(true);

      const derived: Incident[] = [];

      // 1) Workloads that are down, degraded, or crash-restarting
      for (const w of (wlData.workloads || []) as Workload[]) {
        const down = w.status === 'Down';
        const degraded = w.status === 'Degraded';
        if (!down && !degraded && w.restarts < 1) continue;
        const reason = down ? 'CrashLoopBackOff' : degraded ? 'Unhealthy' : 'BackOff';
        const f = friendlyFor(reason);
        const severity: Incident['severity'] = down || w.restarts >= 5 ? 'critical' : 'warning';
        const title = down
          ? `${w.name} is down`
          : degraded
          ? `${w.name} is degraded`
          : `${w.name} restarted ${w.restarts} times`;
        derived.push({
          id: `wl:${w.namespace}/${w.name}`,
          severity, crashType: reason, title,
          why: down
            ? 'None of its pods are ready — the container is failing to run.'
            : degraded
            ? `Only ${w.pods_ready} of ${w.pods_desired} pods are ready.`
            : `Its pods have restarted ${w.restarts} times — they may be crashing intermittently.`,
          fix: f.fix, cmd: f.cmd,
          namespace: w.namespace, podName: w.name, kind: 'Deployment',
          count: w.restarts || 1, lastSeen: new Date().toISOString(),
          rawMessage: `${w.pods_ready}/${w.pods_desired} pods ready · ${w.restarts} restarts · status ${w.status}`,
          source: 'workload',
        });
      }

      // 2) Warning events straight from the cluster
      for (const e of (evData.events || []) as ClusterEvent[]) {
        if (e.type !== 'Warning') continue;
        const f = friendlyFor(e.reason);
        derived.push({
          id: `ev:${e.namespace}/${e.object_name}/${e.reason}`,
          severity: CRITICAL_REASONS.has(e.reason) ? 'critical' : 'warning',
          crashType: e.reason, title: `${e.object_name}: ${f.title.toLowerCase()}`,
          why: f.why, fix: f.fix, cmd: f.cmd,
          namespace: e.namespace, podName: e.object_name, kind: e.object_kind || 'Pod',
          count: e.count || 1, lastSeen: e.last_seen,
          rawMessage: e.message, source: 'event',
        });
      }

      const map = new Map<string, Incident>();
      for (const inc of derived) {
        const prev = map.get(inc.id);
        if (!prev || inc.count > prev.count) map.set(inc.id, inc);
      }
      const sorted = [...map.values()].sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      });

      setIncidents(sorted);
      setUpdatedAt(new Date());
    } catch {
      setReachable(false);
    } finally {
      setLoading(false);
    }
  }, [selectedCluster]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  const critical = incidents.filter(i => i.severity === 'critical');
  const warnings = incidents.filter(i => i.severity === 'warning');
  const namespaces = new Set(incidents.map(i => i.namespace)).size;
  const filtered = filter === 'critical' ? critical : filter === 'warning' ? warnings : incidents;

  const resolveCmd = (inc: Incident) =>
    (inc.cmd || '').replace(/<name>|<pod>/g, inc.podName || 'pod').replace('<node>', 'node');

  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Incidents</h1>
          <p className="kb-welcome-sub">
            What&apos;s breaking in <b style={{ color: 'var(--green)' }}>{cluster}</b> right now
            {updatedAt && ` · updated ${timeAgo(updatedAt.toISOString())}`}
          </p>
        </div>
        <div className="kb-welcome-actions">
          <span className="kb-live-tag"><span className="kb-live-dot" /> live · 10s</span>
          <button className="kb-btn" onClick={() => load()}>↻ Refresh</button>
        </div>
      </div>

      <div className="kb-stat-row">
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">△</span><span className="kb-statcard-label">Active incidents</span></div>
          <div className={`kb-statcard-val ${incidents.length ? 'crit' : 'ok'}`}>{incidents.length}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">in {cluster}</span></div>
        </div>
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">●</span><span className="kb-statcard-label">Critical</span></div>
          <div className={`kb-statcard-val ${critical.length ? 'crit' : 'ok'}`}>{critical.length}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">pods actively broken</span></div>
        </div>
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">⚠</span><span className="kb-statcard-label">Warnings</span></div>
          <div className="kb-statcard-val">{warnings.length}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">restarts / probe fails</span></div>
        </div>
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">◲</span><span className="kb-statcard-label">Namespaces hit</span></div>
          <div className="kb-statcard-val">{namespaces}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">out of the cluster</span></div>
        </div>
      </div>

      <div className="kb-card">
        <div className="kb-col-header">
          <span className="kb-col-title">Live incidents</span>
          <span className="kb-count">{filtered.length}</span>
          <div className="kb-filterbar">
            {(['all', 'critical', 'warning'] as const).map(f => (
              <button key={f} className={`kb-filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="kb-empty tall">Scanning {cluster} for incidents…</div>
        ) : !reachable ? (
          <div className="kb-empty tall">Could not reach the Kubric backend at {API_BASE}. Is it running?</div>
        ) : filtered.length === 0 ? (
          <div className="kb-empty tall">✓ Nothing is broken — {cluster} is healthy.</div>
        ) : (
          <div>
            {filtered.map(inc => {
              const isOpen = expanded === inc.id;
              return (
                <div key={inc.id} className="kb-incx-wrap">
                  <div className={`kb-incx ${inc.severity}`} role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : inc.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isOpen ? null : inc.id); } }}>
                    <span className={`kb-incx-icon ${inc.severity}`}>{friendlyFor(inc.crashType).glyph}</span>
                    <div className="kb-incx-body">
                      <div className="kb-incx-title">{inc.title}</div>
                      <div className="kb-incx-why">{inc.why}</div>
                      <div className="kb-incx-loc">
                        <span className="kb-loc-chip"><span className="k">Cluster</span>{cluster}</span>
                        <span className="kb-loc-chip"><span className="k">Namespace</span>{inc.namespace}</span>
                        <span className="kb-loc-chip"><span className="k">{inc.kind}</span>{inc.podName}</span>
                      </div>
                    </div>
                    <div className="kb-incx-right">
                      <span className={`kb-crash-badge ${inc.severity}`}>{inc.crashType}</span>
                      <span className="kb-incx-meta">
                        {inc.count > 1 && <span className="kb-incx-cnt">×{inc.count}</span>}
                        <span className="kb-incx-time">{timeAgo(inc.lastSeen)}</span>
                        <span className="kb-inc-chevron">{isOpen ? '▾' : '▸'}</span>
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="kb-incx-detail">
                      <div className="kb-incx-loctable">
                        <div><span className="k">Cluster</span><code>{cluster}</code></div>
                        <div><span className="k">Namespace</span><code>{inc.namespace}</code></div>
                        <div><span className="k">{inc.kind}</span><code>{inc.podName}</code></div>
                        <div><span className="k">Crash type</span><code>{inc.crashType}</code></div>
                      </div>

                      <div className="kb-incx-sec">
                        <span className="kb-field-label">What happened</span>
                        <p className="kb-explanation">{inc.why}</p>
                      </div>
                      <div className="kb-incx-sec">
                        <span className="kb-field-label">Raw signal from Kubernetes</span>
                        <p className="kb-explanation mono">{inc.rawMessage}</p>
                      </div>
                      <div className="kb-incx-sec">
                        <span className="kb-field-label accent">How to fix it</span>
                        <p className="kb-fix">{inc.fix}</p>
                      </div>
                      {inc.cmd && (
                        <div className="kb-incx-sec">
                          <span className="kb-field-label">Investigate / fix command</span>
                          <code className="kb-code">{resolveCmd(inc)}</code>
                        </div>
                      )}
                      <div className="kb-audit">Detected live from {inc.source === 'workload' ? 'workload status' : 'cluster events'} · {cluster}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
