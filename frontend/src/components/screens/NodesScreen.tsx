'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface Node {
  name: string;
  roles: string[];
  status: string;
  cpu_pct: number;
  mem_pct: number;
  cpu_capacity: string;
  mem_capacity: string;
  created_at: string | null;
}

export default function NodesScreen({ selectedCluster }: { selectedCluster: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    const context = selectedCluster ? `?context=${encodeURIComponent(selectedCluster)}` : '';
    try {
      const res = await fetch(`${API_BASE}/nodes${context}`);
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = await res.json();
      setNodes(data.nodes || []);
      setReachable(true);
    } catch {
      setReachable(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCluster]);

  useEffect(() => {
    setLoading(true);
    load(true);
    const id = setInterval(() => load(true), 10000);
    return () => clearInterval(id);
  }, [load]);

  const summary = useMemo(() => {
    const ready = nodes.filter(n => n.status === 'Ready').length;
    const avgCpu = nodes.length ? Math.round(nodes.reduce((sum, n) => sum + n.cpu_pct, 0) / nodes.length) : 0;
    const avgMem = nodes.length ? Math.round(nodes.reduce((sum, n) => sum + n.mem_pct, 0) / nodes.length) : 0;
    return { ready, avgCpu, avgMem };
  }, [nodes]);

  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Nodes</h1>
          <p className="kb-welcome-sub">Capacity and health for {selectedCluster || 'the active cluster'}</p>
        </div>
        <div className="kb-welcome-actions">
          <span className="kb-live-tag"><span className="kb-live-dot" /> live · 10s</span>
          <button className="kb-btn" onClick={() => load()} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>
        </div>
      </div>

      <div className="kb-stat-row">
        {[
          { label: 'Nodes', value: nodes.length, meta: 'total capacity', tone: '' },
          { label: 'Ready', value: summary.ready, meta: `${nodes.length - summary.ready} unavailable`, tone: summary.ready === nodes.length ? 'ok' : 'crit' },
          { label: 'Average CPU', value: `${summary.avgCpu}%`, meta: 'across all nodes', tone: summary.avgCpu > 85 ? 'crit' : '' },
          { label: 'Average memory', value: `${summary.avgMem}%`, meta: 'across all nodes', tone: summary.avgMem > 85 ? 'crit' : '' },
        ].map(item => (
          <div className="kb-statcard" key={item.label}>
            <div className="kb-statcard-top"><span className="kb-statcard-icon">◇</span><span className="kb-statcard-label">{item.label}</span></div>
            <div className={`kb-statcard-val ${item.tone}`}>{item.value}</div>
            <div className="kb-statcard-foot"><span className="kb-statcard-meta">{item.meta}</span></div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="kb-card"><div className="kb-empty tall"><span className="kb-spinner sm" /> Loading node health…</div></div>
      ) : !reachable ? (
        <div className="kb-card kb-empty-state"><div className="kb-empty tall">Could not reach the cluster API.<button className="kb-btn" onClick={() => load()}>Try again</button></div></div>
      ) : nodes.length === 0 ? (
        <div className="kb-card"><div className="kb-empty tall">No nodes were returned for this cluster.</div></div>
      ) : (
        <div className="kb-node-grid">
          {nodes.map(n => (
            <article key={n.name} className="kb-card kb-node-card">
              <div className="kb-node-head">
                <span className={`kb-dot-sm ${n.status === 'Ready' ? 'ok' : 'crit'}`} />
                <span className="kb-node-name" title={n.name}>{n.name}</span>
                <span className={`kb-tag ${n.status === 'Ready' ? 'teal' : 'red'}`}>{n.status}</span>
              </div>
              <div className="kb-node-roles">{n.roles.length ? n.roles.join(', ') : 'worker'}</div>
              <div className="kb-meter">
                <div className="kb-meter-head"><span>CPU utilization</span><span className="kb-meter-pct">{n.cpu_pct}%</span></div>
                <NodeSegBar pct={n.cpu_pct} />
              </div>
              <div className="kb-meter">
                <div className="kb-meter-head"><span>Memory utilization</span><span className="kb-meter-pct">{n.mem_pct}%</span></div>
                <NodeSegBar pct={n.mem_pct} />
              </div>
              <div className="kb-node-caps"><span>{n.cpu_capacity} vCPU</span><span>{n.mem_capacity} memory</span></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeSegBar({ pct }: { pct: number }) {
  const segs = 20;
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * segs);
  const tone = pct >= 90 ? 'crit' : pct >= 75 ? 'warn' : '';
  return (
    <div className="kb-segbar" aria-label={`${pct}% utilized`}>
      {Array.from({ length: segs }).map((_, i) => (
        <span key={i} className={`kb-seg ${i < filled ? `on ${tone}` : ''}`} />
      ))}
    </div>
  );
}
