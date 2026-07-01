'use client';

import { useEffect, useState } from 'react';

interface Workload {
  name: string;
  namespace: string;
  pods_ready: number;
  pods_desired: number;
  cpu_m: number;
  mem_mi: number;
  restarts: number;
  status: string;
  risk: 'high' | 'medium' | 'safe';
}

export default function WorkloadsScreen() {
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Workload | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/workloads');
        if (res.ok && active) {
          const data = await res.json();
          setWorkloads(data.workloads || []);
        }
      } catch { /* backend not ready */ } finally {
        if (active) setLoading(false);
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const filtered = workloads.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.namespace.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="kb-screen" style={{ position: 'relative' }}>
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Workloads</h1>
          <p className="kb-welcome-sub">{workloads.length} deployment{workloads.length === 1 ? '' : 's'} across all namespaces</p>
        </div>
        <div className="kb-welcome-actions">
          <input
            className="kb-search-input kb-workload-search"
            placeholder="Search workloads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="kb-card">
        <div className="kb-table-head-row">
          <span>Service</span><span>Pods</span><span>CPU</span><span>Memory</span><span>Status</span><span>Risk</span>
        </div>
        {loading ? (
          <div className="kb-empty tall">Loading workloads…</div>
        ) : filtered.length === 0 ? (
          <div className="kb-empty tall">No workloads found. Is the backend connected to a cluster?</div>
        ) : (
          filtered.map(w => (
            <div key={`${w.namespace}/${w.name}`} className="kb-wl-row" onClick={() => setSelected(w)}>
              <span className="kb-wl-service">
                <span className={`kb-dot-sm ${w.status === 'Healthy' ? 'ok' : w.status === 'Down' ? 'crit' : 'warn'}`} />
                <span className="kb-wl-name">{w.name}</span>
                <span className="kb-wl-ns">{w.namespace}</span>
              </span>
              <span className={`kb-wl-pods ${w.pods_ready < w.pods_desired ? 'warn' : ''}`}>{w.pods_ready}/{w.pods_desired}</span>
              <span className="kb-wl-metric">{w.cpu_m}m</span>
              <span className="kb-wl-metric">{w.mem_mi}Mi</span>
              <span className={`kb-tag ${w.status === 'Healthy' ? 'teal' : w.status === 'Down' ? 'red' : 'amber'}`}>{w.status}</span>
              <span className={`kb-risk-badge ${w.risk}`}>{w.risk}</span>
            </div>
          ))
        )}
      </div>

      {/* drawer */}
      {selected && (
        <>
          <div className="kb-drawer-backdrop" onClick={() => setSelected(null)} />
          <div className="kb-drawer">
            <div className="kb-drawer-head">
              <div>
                <div className="kb-drawer-title">{selected.name}</div>
                <div className="kb-drawer-sub">{selected.namespace}</div>
              </div>
              <button className="kb-drawer-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="kb-drawer-body">
              <div className="kb-drawer-row"><span>Status</span><span className={`kb-tag ${selected.status === 'Healthy' ? 'teal' : selected.status === 'Down' ? 'red' : 'amber'}`}>{selected.status}</span></div>
              <div className="kb-drawer-row"><span>Pods</span><span>{selected.pods_ready} / {selected.pods_desired} ready</span></div>
              <div className="kb-drawer-row"><span>CPU usage</span><span>{selected.cpu_m}m</span></div>
              <div className="kb-drawer-row"><span>Memory usage</span><span>{selected.mem_mi}Mi</span></div>
              <div className="kb-drawer-row"><span>Restarts</span><span className={selected.restarts > 0 ? 'kb-warn-text' : ''}>{selected.restarts}</span></div>
              <div className="kb-drawer-row"><span>Risk</span><span className={`kb-risk-badge ${selected.risk}`}>{selected.risk}</span></div>
              {selected.risk !== 'safe' && (
                <div className="kb-nested" style={{ marginTop: 12 }}>
                  <span className="kb-field-label">Suggested action</span>
                  <p className="kb-explanation">
                    {selected.status === 'Down'
                      ? 'All pods are down. Check recent events and logs, or run a full investigation from Troubleshoot.'
                      : selected.restarts > 0
                      ? 'Pods are restarting. Likely a crash loop or failing readiness probe — investigate logs.'
                      : 'Some replicas are not ready yet. Monitor rollout status.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
