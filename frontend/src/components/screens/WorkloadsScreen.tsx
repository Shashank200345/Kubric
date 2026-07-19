'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { insforge } from '@/lib/insforge';
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

interface SuggestedAction {
  action_type: string;
  params: Record<string, unknown>;
}

interface WorkloadInvestigation {
  id?: string;
  root_cause?: string;
  explanation?: string;
  fix?: string;
  kubectl_command?: string;
  suggested_action?: SuggestedAction;
  not_found?: boolean;
}

interface ActionMessage {
  payload?: ActionMessage;
  status?: 'idle' | 'pending' | 'success' | 'failed';
  output?: unknown;
}

export default function WorkloadsScreen({ selectedCluster }: { selectedCluster: string }) {
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Workload | null>(null);

  const [investigation, setInvestigation] = useState<WorkloadInvestigation | null>(null);
  const [commandStatus, setCommandStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [troubleshootLoading, setTroubleshootLoading] = useState(false);

  useEffect(() => {
    setInvestigation(null);
    setCommandStatus('idle');
    setCommandOutput(null);
    if (!selected) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  useEffect(() => {
    insforge.realtime.subscribe('actions:workloads');
    insforge.realtime.on('actions_updated', (msg: ActionMessage) => {
      const payload = msg?.payload ?? msg;
      if (payload && payload.status) {
        setCommandStatus(payload.status);
        if (payload.output) {
          setCommandOutput(typeof payload.output === 'object' ? JSON.stringify(payload.output, null, 2) : String(payload.output));
        }
      }
    });
    return () => {
      insforge.realtime.unsubscribe('actions:workloads');
    };
  }, []);

  const handleTroubleshoot = async () => {
    if (!selected) return;
    setTroubleshootLoading(true);
    const { data } = await insforge.database
      .from('investigations')
      .select('*')
      .or(`root_cause.ilike.%${selected.name}%,explanation.ilike.%${selected.name}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setInvestigation(data[0]);
    } else {
      setInvestigation({ not_found: true });
    }
    setTroubleshootLoading(false);
  };

  const handleApproveFix = async () => {
    if (!investigation || !investigation.suggested_action) return;
    setCommandStatus('pending');
    setCommandOutput(null);
    const authHeader = insforge.getHttpClient().getHeaders()['Authorization'];
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      setCommandStatus('failed');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          investigation_id: investigation.id,
          action_type: investigation.suggested_action.action_type,
          params: investigation.suggested_action.params
        })
      });
      if (!res.ok) setCommandStatus('failed');
    } catch {
      setCommandStatus('failed');
    }
  };

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const context = selectedCluster ? `?context=${encodeURIComponent(selectedCluster)}` : '';
      try {
        const res = await fetch(`${API_BASE}/workloads${context}`);
        if (!res.ok) throw new Error(`Request failed with ${res.status}`);
        if (active) {
          const data = await res.json();
          setWorkloads(data.workloads || []);
          setReachable(true);
        }
      } catch {
        if (active) setReachable(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
  }, [selectedCluster]);

  const filtered = workloads.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.namespace.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="kb-screen" style={{ position: 'relative' }}>
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Workloads</h1>
          <p className="kb-welcome-sub">{workloads.length} deployment{workloads.length === 1 ? '' : 's'} in {selectedCluster || 'the active cluster'}</p>
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
          <div className="kb-empty tall"><span className="kb-spinner sm" /> Loading workloads…</div>
        ) : !reachable ? (
          <div className="kb-empty tall">Could not reach the workload API for {selectedCluster || 'this cluster'}.</div>
        ) : filtered.length === 0 ? (
          <div className="kb-empty tall">{search ? `No workloads match “${search}”.` : 'No workloads were returned for this cluster.'}</div>
        ) : (
          filtered.map(w => (
            <div
              key={`${w.namespace}/${w.name}`}
              className="kb-wl-row"
              role="button"
              tabIndex={0}
              onClick={() => setSelected(w)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(w); } }}
            >
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
          <button type="button" className="kb-drawer-backdrop" onClick={() => setSelected(null)} aria-label="Close workload details" />
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
                  {!investigation ? (
                    <>
                      <p className="kb-explanation" style={{ marginBottom: '12px' }}>
                        {selected.status === 'Down'
                          ? 'All pods are down. Check recent events and logs, or run a full investigation from Troubleshoot.'
                          : selected.restarts > 0
                          ? 'Pods are restarting. Likely a crash loop or failing readiness probe — investigate logs.'
                          : 'Some replicas are not ready yet. Monitor rollout status.'}
                      </p>
                      <button className="kb-btn" onClick={handleTroubleshoot} disabled={troubleshootLoading}>
                        {troubleshootLoading ? 'Starting...' : 'Troubleshoot'}
                      </button>
                    </>
                  ) : investigation.not_found ? (
                    <p className="kb-explanation">No active investigation found for this workload. Ensure the agent has detected the issue.</p>
                  ) : (
                    <>
                      <p className="kb-root-cause" style={{ marginTop: '8px', fontWeight: 500 }}>{investigation.root_cause}</p>
                      <p className="kb-explanation" style={{ marginTop: '8px' }}>{investigation.explanation}</p>
                      <p className="kb-fix" style={{ marginTop: '8px', color: 'var(--t1)' }}>{investigation.fix}</p>
                      {investigation.kubectl_command && (
                        <div style={{ marginTop: '12px' }}>
                          <span className="kb-field-label">Manual command (GitOps friendly)</span>
                          <pre className="kb-code" style={{ marginTop: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                            {investigation.kubectl_command}
                          </pre>
                        </div>
                      )}
                      {investigation.suggested_action && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                          {commandStatus === 'idle' && (
                            <button className="kb-btn" style={{ alignSelf: 'flex-start', background: '#10b981', color: 'white', border: 'none' }} onClick={handleApproveFix}>
                              Approve & Run Fix
                            </button>
                          )}
                          {commandStatus === 'pending' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--t2)' }}>
                              <span className="kb-spinner xs" />
                              Waiting for cluster agent to execute...
                            </div>
                          )}
                          {commandStatus === 'success' && (
                            <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '6px' }}>
                              <div style={{ color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>✓ Fix applied successfully</div>
                              <pre style={{ margin: 0, fontSize: '12px', color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{commandOutput}</pre>
                            </div>
                          )}
                          {commandStatus === 'failed' && (
                            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px' }}>
                              <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>✗ Fix failed</div>
                              <pre style={{ margin: 0, fontSize: '12px', color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{commandOutput}</pre>
                              <button className="kb-btn" style={{ marginTop: '8px' }} onClick={() => setCommandStatus('idle')}>Try again</button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
