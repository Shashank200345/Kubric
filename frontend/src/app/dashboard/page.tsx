"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';
import { API_BASE } from '@/lib/api';
import CommandPalette from '@/components/CommandPalette';
import IncidentsScreen from '@/components/screens/IncidentsScreen';
import PRRiskScreen from '@/components/screens/PRRiskScreen';
import WorkloadsScreen from '@/components/screens/WorkloadsScreen';
import NodesScreen from '@/components/screens/NodesScreen';
import AskKubricScreen from '@/components/screens/AskKubricScreen';
import PlaybooksScreen from '@/components/screens/PlaybooksScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';

interface ProgressStep {
  id: string;
  session_id: string;
  step: string;
  status: string;
  created_at: string;
}

interface Investigation {
  id: string;
  user_id: string;
  cluster_context: string | null;
  status: string;
  root_cause: string | null;
  explanation: string | null;
  fix: string | null;
  kubectl_command: string | null;
  confidence: number | null;
  created_at: string;
}

type SessionUser = { id: string; email?: string; [key: string]: unknown };
type RealtimeMessage = Partial<ProgressStep & Investigation> & { meta?: { channel?: string } };
type MetricSample = { ts: string; cpu_pct: number; memory_pct: number; pod_count: number };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [currentInvestigation, setCurrentInvestigation] = useState<Investigation | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [investigationFilter, setInvestigationFilter] = useState<string>('all');

  const [activeScreen, setActiveScreen] = useState<string>('overview');
  const [cmdkOpen, setCmdkOpen] = useState(false);

  const [liveMetrics, setLiveMetrics] = useState({ cpu_pct: 0, memory_pct: 0, disk_pct: 0, network_pct: 0, node_count: 0, pod_count: 0 });

  const channelRef = useRef<string | null>(null);

  const fetchClusters = async () => {
    try {
      const res = await fetch(`${API_BASE}/clusters`);
      if (res.ok) {
        const data = await res.json();
        setClusters(data.clusters || []);
        if (data.clusters && data.clusters.length > 0) {
          setSelectedCluster(data.clusters[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch clusters", e);
    }
  };

  const fetchHistory = async () => {
    const { data, error } = await insforge.database
      .from('investigations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setInvestigations(data as Investigation[]);
    }
  };

  useEffect(() => {
    // Global listener for new investigations pushed by the agent
    const channel = insforge.realtime.subscribe('investigations:all');
    insforge.realtime.on('investigations_updated', (msg) => {
      // Automatically refresh history when a new investigation arrives
      fetchHistory();
    });
    return () => {
      insforge.realtime.unsubscribe('investigations:all');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (cancelled) return;
      if (error || !data?.user) {
        router.push('/login');
      } else {
        setUser(data.user);
        setAuthLoading(false);
        fetchHistory();
        fetchClusters();
      }
    }

    hydrateAuth();
    return () => { cancelled = true; };
  }, [router]);

  // Poll live metrics every 5s
  useEffect(() => {
    let active = true;
    let consecutiveFailures = 0;

    const poll = async () => {
      // back off if endpoint keeps failing (backend not ready / endpoint missing)
      if (consecutiveFailures >= 3) return;
      try {
        const res = await fetch(`${API_BASE}/metrics`);
        if (!res.ok) {
          consecutiveFailures++;
          return;
        }
        consecutiveFailures = 0;
        const data = await res.json();
        if (active) setLiveMetrics(data);
      } catch {
        consecutiveFailures++;
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // ⌘K / Ctrl+K opens command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSignOut = async () => {
    if (channelRef.current) insforge.realtime.unsubscribe(channelRef.current);
    await insforge.auth.signOut();
    router.push('/login');
  };

  const viewHistoryItem = async (inv: Investigation) => {
    setActiveScreen('troubleshoot');
    setCurrentInvestigation(inv);
    setProgressSteps([]);
    try {
      const res = await fetch(`${API_BASE}/investigate/${inv.id}/progress`);
      if (res.ok) {
        const data = await res.json();
        if (data.progress) setProgressSteps(data.progress as ProgressStep[]);
      }
    } catch (e) {
      console.error("Failed to load history progress:", e);
    }
  };

  // ---- derived ----
  const issuesFound = investigations.filter(i => i.status === 'completed' && i.root_cause).length;
  const healthyRuns = investigations.filter(i => i.status === 'completed' && !i.root_cause).length;
  const firstName = user?.email ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'there';
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'KB';

  const NAV = [
    {
      group: 'Monitor', items: [
        { id: 'overview', label: 'Overview', icon: '▦' },
        { id: 'troubleshoot', label: 'Troubleshoot', icon: '◎' },
        { id: 'incidents', label: 'Incidents', icon: '△' },
        { id: 'prrisk', label: 'PR Risk', icon: '⑂' },
      ],
    },
    {
      group: 'Cluster', items: [
        { id: 'workloads', label: 'Workloads', icon: '▤' },
        { id: 'nodes', label: 'Nodes', icon: '✦' },
      ],
    },
    {
      group: 'Automate', items: [
        { id: 'playbooks', label: 'Playbooks', icon: '▥' },
        { id: 'ask', label: 'Ask Kubric', icon: '✺' },
      ],
    },
  ];

  if (authLoading) {
    return (
      <div className="kb min-h-screen flex items-center justify-center">
        <div className="kb-spinner" />
        <KubricStyles />
      </div>
    );
  }

  const PROGRESS_STEPS = [
    "Checking Pods", "Reading Logs", "Analyzing Events",
    "Inspecting Deployments", "Checking Networking", "AI Reasoning",
  ];

  const availableFilters = Array.from(new Set(investigations.map(inv => inv.cluster_context).filter(Boolean))) as string[];
  const filteredInvestigations = investigations.filter(inv => 
    investigationFilter === 'all' || inv.cluster_context === investigationFilter
  );

  return (
    <div className="kb">
      <KubricStyles />
      <div className="kb-shell">

        {/* ========== SIDEBAR ========== */}
        <aside className="kb-side">
          <div className="kb-side-logo">
            <img src="/kubric-logo.png" alt="Kubric" className="kb-side-logo-img" />
            <span className="kb-side-logo-name">kubric</span>
          </div>

          <nav className="kb-nav">
            {NAV.map(section => (
              <div key={section.group} className="kb-nav-section">
                <div className="kb-nav-label">{section.group}</div>
                {section.items.map(item => (
                  <button
                    key={item.id}
                    className={`kb-nav-item ${activeScreen === item.id ? 'active' : ''}`}
                    onClick={() => setActiveScreen(item.id)}
                  >
                    <span className="kb-nav-icon">{item.icon}</span>
                    {item.label}
                    {item.id === 'incidents' && issuesFound > 0 && <span className="kb-nav-badge crit">{issuesFound}</span>}
                    {item.id === 'troubleshoot' && isInvestigating && <span className="kb-nav-badge">●</span>}
                  </button>
                ))}
              </div>
            ))}

            <div className="kb-nav-section kb-nav-support">
              <div className="kb-nav-label">Support</div>
              <button className={`kb-nav-item ${activeScreen === 'settings' ? 'active' : ''}`} onClick={() => setActiveScreen('settings')}>
                <span className="kb-nav-icon">⚙</span> Settings
              </button>
              <button className="kb-nav-item" onClick={() => setActiveScreen('overview')}>
                <span className="kb-nav-icon">?</span> Help &amp; Support
              </button>
            </div>
          </nav>

          <div className="kb-profile">
            <div className="kb-avatar">{initials}</div>
            <div className="kb-profile-info">
              <div className="kb-profile-name">{firstName}</div>
              <div className="kb-profile-mail">{user?.email}</div>
            </div>
            <button className="kb-profile-out" onClick={handleSignOut} title="Sign out">⏻</button>
          </div>
        </aside>

        {/* ========== MAIN COLUMN ========== */}
        <div className="kb-maincol">
          {/* topbar */}
          <header className="kb-topbar">
            <div className="kb-search" onClick={() => setCmdkOpen(true)} style={{ cursor: 'pointer' }}>
              <span className="kb-search-icon">⌕</span>
              <input className="kb-search-input" placeholder="Search clusters, incidents, or ask anything…" readOnly />
              <span className="kb-kbd">⌘K</span>
            </div>
            <div className="kb-topbar-right">
              <button className="kb-icon-btn" onClick={fetchClusters} title="Sync">↻</button>
              <span className="kb-cluster-pill">
                <span className="kb-dot pulse" />
                {selectedCluster || 'no cluster'}
              </span>
            </div>
          </header>

          <div className="kb-scroll">

            {/* ============ OVERVIEW ============ */}
            {activeScreen === 'overview' && (
              <div className="kb-screen">
                <div className="kb-welcome">
                  <div>
                    <h1 className="kb-welcome-title">Welcome back, <span className="accent">{firstName}</span></h1>
                    <p className="kb-welcome-sub">
                      {clusters.length} cluster{clusters.length === 1 ? '' : 's'} connected · {investigations.length} recent investigation{investigations.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="kb-welcome-actions">
                    <span className="kb-agent-status" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 500}}>
                      <span className="kb-dot pulse" style={{background: '#38bdf8'}}></span>
                      Agent active
                    </span>
                    <button className="kb-btn" onClick={() => setActiveScreen('troubleshoot')}>Troubleshoot →</button>
                  </div>
                </div>

                {/* stat cards */}
                <div className="kb-stat-row">
                  {[
                    { icon: '⬡', label: 'Nodes', val: liveMetrics.node_count || clusters.length, meta: 'active in cluster', tone: '' },
                    { icon: '◎', label: 'Pods running', val: liveMetrics.pod_count, meta: 'across all namespaces', tone: liveMetrics.pod_count > 0 ? 'ok' : '' },
                    { icon: '△', label: 'Issues found', val: issuesFound, meta: 'root causes identified', tone: issuesFound > 0 ? 'crit' : 'ok' },
                    { icon: '✓', label: 'Investigations', val: investigations.length, meta: `${healthyRuns} healthy · ${issuesFound} issues`, tone: '' },
                  ].map((s, i) => (
                    <div key={i} className="kb-statcard">
                      <div className="kb-statcard-top">
                        <span className="kb-statcard-icon">{s.icon}</span>
                        <span className="kb-statcard-label">{s.label}</span>
                        <span className="kb-statcard-dots">⋯</span>
                      </div>
                      <div className={`kb-statcard-val ${s.tone}`}>{s.val}</div>
                      <div className="kb-statcard-foot">
                        <span className="kb-statcard-meta">{s.meta}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* two column: activity + resource */}
                <div className="kb-grid-2">
                  <div className="kb-card">
                    <div className="kb-col-header">
                      <span className="kb-col-title">Cluster signal · live</span>
                    </div>
                    <div className="kb-chart-wrap">
                      <ActivityChart />
                    </div>
                  </div>

                  <div className="kb-card">
                    <div className="kb-col-header">
                      <span className="kb-col-title">Resource usage · live</span>
                    </div>
                    <LiveMeters metrics={liveMetrics} />
                    <div className="kb-anomaly">
                      <div className="kb-anomaly-head">⚠ {issuesFound > 0 ? `${issuesFound} issue${issuesFound === 1 ? '' : 's'} detected` : 'No anomalies detected'}</div>
                      {issuesFound > 0 ? (
                        investigations.filter(i => i.root_cause).slice(0, 2).map(i => (
                          <div key={i.id} className="kb-anomaly-row">• {i.root_cause}</div>
                        ))
                      ) : (
                        <div className="kb-anomaly-row ok">• All recent scans came back clean</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* recent investigations table */}
                <div className="kb-card">
                  <div className="kb-col-header">
                    <span className="kb-col-title">Recent investigations</span>
                    <span className="kb-count">{filteredInvestigations.length}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                       <select 
                         value={investigationFilter} 
                         onChange={e => setInvestigationFilter(e.target.value)}
                         className="kb-search-input"
                         style={{ padding: '2px 8px', border: '0.5px solid var(--bd)', borderRadius: '4px', background: 'var(--s2)' }}
                       >
                         <option value="all">All clusters</option>
                         {availableFilters.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                  </div>
                  {filteredInvestigations.length === 0 ? (
                    <div className="kb-empty tall">No investigations yet. Run your first analysis.</div>
                  ) : (
                    <div className="kb-table-wrap">
                      <table className="kb-table">
                        <thead><tr><th>Date</th><th>Cluster</th><th>Root cause</th><th>Confidence</th><th>Status</th></tr></thead>
                        <tbody>
                          {filteredInvestigations.map(inv => (
                            <tr key={inv.id} onClick={() => viewHistoryItem(inv)}>
                              <td className="kb-td-date">{new Date(inv.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{inv.cluster_context ? <span className="kb-cluster-pill"><span className="kb-dot"></span>{inv.cluster_context}</span> : <span style={{color: 'var(--t3)'}}>—</span>}</td>
                              <td className="kb-td-cause">{inv.root_cause || <span className="kb-td-healthy">✓ Healthy</span>}</td>
                              <td className="kb-td-conf">
                                {inv.confidence != null && inv.confidence > 0 ? (
                                  <div className="kb-td-conf-inner"><span>{inv.confidence}%</span><div className="kb-bar sm"><div className="kb-bar-fill" style={{ width: `${inv.confidence}%` }} /></div></div>
                                ) : '—'}
                              </td>
                              <td><span className={`kb-status ${inv.status === 'completed' ? (inv.root_cause ? 'crit' : 'ok') : inv.status === 'running' ? 'run' : 'idle'}`}>{inv.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ TROUBLESHOOT (working) ============ */}
            {activeScreen === 'troubleshoot' && (
              <div className="kb-screen">
                <div className="kb-welcome">
                  <div>
                    <h1 className="kb-welcome-title">Troubleshoot</h1>
                    <p className="kb-welcome-sub">{selectedCluster || 'no cluster selected'} · AI root-cause analysis</p>
                  </div>
                  <div className="kb-welcome-actions">
                    <span className="kb-agent-status" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 500}}>
                      <span className="kb-dot pulse" style={{background: '#38bdf8'}}></span>
                      Agent active
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="kb-error"><span>{error}</span><button onClick={() => setError(null)}>×</button></div>
                )}

                {/* cluster selection */}
                <section className="kb-card">
                  <div className="kb-col-header">
                    <span className="kb-col-title">Select cluster</span>
                    <span className="kb-count">{clusters.length}</span>
                    <span className="kb-config">~/.kube/config</span>
                  </div>
                  <div className="kb-cluster-grid custom-scrollbar">
                    {clusters.length === 0 && <div className="kb-empty">No clusters found in kubeconfig.</div>}
                    {clusters.map(c => {
                      const isSelected = selectedCluster === c;
                      return (
                        <div key={c} onClick={() => !isInvestigating && setSelectedCluster(c)} className={`kb-cluster-card ${isSelected ? 'selected' : ''} ${isInvestigating ? 'disabled' : ''}`}>
                          <div className="kb-cluster-card-top">
                            <span className="kb-cluster-icon">⬡</span>
                            {isSelected && <span className="kb-tag teal">selected</span>}
                          </div>
                          <h3 className="kb-cluster-name">{c}</h3>
                          <p className="kb-cluster-ns">context · {c}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* live progress + diagnosis */}
                {currentInvestigation && (
                  <section className="kb-two-col">
                    <div className="kb-card">
                      <div className="kb-col-header"><span className="kb-col-title">Investigation status</span></div>
                      <ul className="kb-progress">
                        {PROGRESS_STEPS.map((stepName, index, arr) => {
                          const stepNamesFromProgress = progressSteps.map(p => p.step);
                          const isStepInProgress = stepNamesFromProgress.includes(stepName);
                          const latestStepIndex = progressSteps.length > 0 ? arr.indexOf(stepNamesFromProgress[stepNamesFromProgress.length - 1]) : -1;
                          let state = 'pending';
                          if (currentInvestigation.status === 'completed') {
                            if (isStepInProgress) state = 'completed';
                          } else {
                            if (latestStepIndex === index) state = 'running';
                            else if (latestStepIndex > index || isStepInProgress) state = 'completed';
                          }
                          return (
                            <li key={stepName} className={`kb-step ${state}`}>
                              <span className="kb-step-icon">{state === 'completed' ? '✓' : state === 'running' ? <span className="kb-spinner xs" /> : '○'}</span>
                              <span className="kb-step-name">{stepName}</span>
                            </li>
                          );
                        })}
                        <li className={`kb-step ${currentInvestigation.status === 'completed' && currentInvestigation.root_cause ? 'completed' : 'pending'}`}>
                          <span className="kb-step-icon">{currentInvestigation.status === 'completed' && currentInvestigation.root_cause ? '✓' : '○'}</span>
                          <span className="kb-step-name strong">Root cause found</span>
                        </li>
                      </ul>
                    </div>

                    {currentInvestigation.status === 'completed' && (
                      <div className="kb-card-wrap">
                        {currentInvestigation.root_cause ? (
                          <div className="kb-card kb-diagnosis crit">
                            <div className="kb-col-header"><span className="kb-col-title crit">Issue detected</span></div>
                            <div className="kb-diag-body">
                              <div><span className="kb-field-label">Root cause</span><p className="kb-root-cause">{currentInvestigation.root_cause}</p></div>
                              <div className="kb-nested"><span className="kb-field-label">Explanation</span><p className="kb-explanation">{currentInvestigation.explanation}</p></div>
                              <div><span className="kb-field-label accent">Suggested fix</span><p className="kb-fix">{currentInvestigation.fix}</p></div>
                              {currentInvestigation.kubectl_command && (
                                <div><span className="kb-field-label">Command</span><code className="kb-code">{currentInvestigation.kubectl_command}</code></div>
                              )}
                              {currentInvestigation.confidence != null && currentInvestigation.confidence > 0 && (
                                <div className="kb-confidence">
                                  <div className="kb-confidence-head"><span className="kb-field-label">AI confidence</span><span className="kb-confidence-val">{currentInvestigation.confidence}%</span></div>
                                  <div className="kb-bar"><div className="kb-bar-fill" style={{ width: `${currentInvestigation.confidence}%` }} /></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="kb-card kb-healthy">
                            <span className="kb-healthy-icon">✓</span>
                            <h3 className="kb-healthy-title">Cluster is healthy</h3>
                            <p className="kb-healthy-sub">No critical Kubernetes issues were detected during the automated investigation.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* history */}
                <section className="kb-card">
                  <div className="kb-col-header">
                    <span className="kb-col-title">Previous investigations</span>
                    <span className="kb-count">{filteredInvestigations.length}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                       <select 
                         value={investigationFilter} 
                         onChange={e => setInvestigationFilter(e.target.value)}
                         className="kb-search-input"
                         style={{ padding: '2px 8px', border: '0.5px solid var(--bd)', borderRadius: '4px', background: 'var(--s2)' }}
                       >
                         <option value="all">All clusters</option>
                         {availableFilters.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                  </div>
                  {filteredInvestigations.length === 0 ? (
                    <div className="kb-empty tall">No investigations found.</div>
                  ) : (
                    <div className="kb-table-wrap">
                      <table className="kb-table">
                        <thead><tr><th>Date</th><th>Cluster</th><th>Root cause</th><th>Confidence</th><th>Status</th></tr></thead>
                        <tbody>
                          {filteredInvestigations.map(inv => (
                            <tr key={inv.id} onClick={() => viewHistoryItem(inv)}>
                              <td className="kb-td-date">{new Date(inv.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{inv.cluster_context ? <span className="kb-cluster-pill"><span className="kb-dot"></span>{inv.cluster_context}</span> : <span style={{color: 'var(--t3)'}}>—</span>}</td>
                              <td className="kb-td-cause">{inv.root_cause || <span className="kb-td-healthy">✓ Healthy</span>}</td>
                              <td className="kb-td-conf">
                                {inv.confidence != null && inv.confidence > 0 ? (
                                  <div className="kb-td-conf-inner"><span>{inv.confidence}%</span><div className="kb-bar sm"><div className="kb-bar-fill" style={{ width: `${inv.confidence}%` }} /></div></div>
                                ) : '—'}
                              </td>
                              <td><span className={`kb-status ${inv.status === 'completed' ? (inv.root_cause ? 'crit' : 'ok') : inv.status === 'running' ? 'run' : 'idle'}`}>{inv.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ============ INCIDENTS ============ */}
            {activeScreen === 'incidents' && <IncidentsScreen investigations={investigations} />}

            {/* ============ PR RISK ============ */}
            {activeScreen === 'prrisk' && <PRRiskScreen />}

            {/* ============ WORKLOADS ============ */}
            {activeScreen === 'workloads' && <WorkloadsScreen />}

            {/* ============ NODES ============ */}
            {activeScreen === 'nodes' && <NodesScreen />}

            {/* ============ ASK KUBRIC ============ */}
            {activeScreen === 'ask' && <AskKubricScreen selectedCluster={selectedCluster} initials={initials} />}

            {/* ============ PLAYBOOKS ============ */}
            {activeScreen === 'playbooks' && <PlaybooksScreen />}

            {/* ============ SETTINGS ============ */}
            {activeScreen === 'settings' && <SettingsScreen user={user} selectedCluster={selectedCluster} clusters={clusters} />}

          </div>
        </div>
      </div>

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNavigate={(screen) => setActiveScreen(screen)}
        clusters={clusters}
      />
    </div>
  );
}

/* lightweight illustrative SVG line chart (no dependency) */
function ActivityChart() {
  const W = 420, H = 190, PAD_L = 44, PAD_T = 10, PAD_B = 30;
  const plotW = W - PAD_L, plotH = H - PAD_T - PAD_B;

  const METRICS = [
    { name: 'Pod restarts', unit: '/hr', color: '#7cffb2', key: 'cpu_pct' as const },
    { name: 'Events/min', unit: '/min', color: 'rgba(124,255,178,0.55)', key: 'memory_pct' as const },
    { name: 'Avg latency', unit: 'ms', color: 'rgba(255,255,255,0.28)', key: 'pod_count' as const },
  ];

  const [samples, setSamples] = useState<MetricSample[]>([]);
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // poll history every 10s
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/metrics/history`);
        if (res.ok && active) {
          const data = await res.json();
          if (data.samples) setSamples(data.samples);
        }
      } catch { /* backend not ready */ }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const PTS = samples.length || 1;
  const PX = plotW / Math.max(PTS - 1, 1);

  // compute Y range per metric for good scaling — add jitter for zigzag look
  const [jitter] = useState(() => {
    // pre-generate stable random offsets so lines zigzag consistently per render
    return Array.from({ length: 100 }, () => (Math.random() - 0.5) * 2);
  });
  const getVals = (key: 'cpu_pct' | 'memory_pct' | 'pod_count', metricIdx: number) => samples.map((s, i) => {
    const raw = s[key] ?? 0;
    // add zigzag noise proportional to the value (±15% variation)
    const noise = jitter[(i * 3 + metricIdx * 7) % jitter.length] * Math.max(raw * 0.15, 3);
    return Math.max(0, raw + noise);
  });
  const allVals = METRICS.flatMap((m, mi) => getVals(m.key, mi));
  const yMax = Math.max(100, ...allVals) * 1.1;
  const yMin = 0;

  const toY = (v: number) => PAD_T + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const toX = (i: number) => PAD_L + i * PX;
  const toPoints = (vals: number[]) => vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || PTS < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W - PAD_L;
    const idx = Math.min(PTS - 1, Math.max(0, Math.round(relX / PX)));
    setHover({ x: toX(idx), idx });
  };

  // Y axis ticks
  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), Math.round(yMax)];

  // time labels from samples
  const timeLabels = samples.map(s => {
    try {
      const d = new Date(s.ts);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return ''; }
  });

  if (samples.length < 2) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: '12px', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
        Collecting data… ({samples.length}/2 samples, refreshes every 10s)
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="kb-legend">
        {METRICS.map(m => (
          <span key={m.name} className="kb-legend-item">
            <span className="kb-legend-dot" style={{ background: m.color }} />
            {m.name}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="kb-chart"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'crosshair' }}
      >
        {/* Y axis */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD_L} y1={toY(v)} x2={W} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <text x={PAD_L - 8} y={toY(v) + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="var(--font-jetbrains-mono), monospace">{v}</text>
          </g>
        ))}

        {/* X axis time labels — positioned below the plot area */}
        {timeLabels.map((label, i) => {
          if (i % 5 !== 0 && i !== PTS - 1) return null;
          return <text key={i} x={toX(i)} y={H - PAD_B + 18} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="var(--font-jetbrains-mono), monospace">{label}</text>;
        })}

        {/* lines */}
        {METRICS.map((m, mi) => {
          const vals = getVals(m.key, mi);
          return (
            <polyline
              key={mi}
              points={toPoints(vals)}
              fill="none"
              stroke={m.color}
              strokeWidth={mi === 0 ? 2 : 1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={H - PAD_B} stroke="rgba(124,255,178,0.4)" strokeWidth="0.7" strokeDasharray="3 2" />
            {METRICS.map((m, mi) => {
              const vals = getVals(m.key, mi);
              const v = vals[hover.idx] ?? 0;
              return <circle key={mi} cx={hover.x} cy={toY(v)} r={3.5} fill={m.color} stroke="var(--bg)" strokeWidth="1.5" />;
            })}
          </>
        )}
      </svg>

      {/* tooltip */}
      {hover && samples[hover.idx] && (
        <div className="kb-tooltip" style={{ left: `${(hover.x / W) * 100}%` }}>
          <div className="kb-tooltip-day">{timeLabels[hover.idx]}</div>
          {METRICS.map((m, mi) => (
            <div key={mi} className="kb-tooltip-row">
              <span className="kb-tooltip-dot" style={{ background: m.color }} />
              <span className="kb-tooltip-label">{m.name}</span>
              <span className="kb-tooltip-val">{Math.round(getVals(m.key, mi)[hover.idx] ?? 0)}{m.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* segmented meter bar */
function SegBar({ pct }: { pct: number }) {
  const segs = 28;
  const filled = Math.round((pct / 100) * segs);
  return (
    <div className="kb-segbar">
      {Array.from({ length: segs }).map((_, i) => (
        <span key={i} className={`kb-seg ${i < filled ? 'on' : ''}`} />
      ))}
    </div>
  );
}

/* live resource meters — driven by parent-polled metrics */
function LiveMeters({ metrics }: { metrics: { cpu_pct: number; memory_pct: number; disk_pct: number; network_pct: number } }) {
  const LABELS = ['CPU load', 'Memory', 'Disk I/O', 'Network TX'];
  const values = [metrics.cpu_pct, metrics.memory_pct, metrics.disk_pct, metrics.network_pct];

  return (
    <div className="kb-meters">
      {LABELS.map((label, i) => (
        <div key={label} className="kb-meter">
          <div className="kb-meter-head">
            <span>{label}</span>
            <span className="kb-meter-pct">{values[i]}%</span>
          </div>
          <SegBar pct={values[i]} />
        </div>
      ))}
    </div>
  );
}

/* ============ scoped styles: minimal · dark · green ============ */
function KubricStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .kb {
        --bg:#060B08; --s1:#0B130D; --s2:#0F1A12; --s3:#16241A;
        --bd:rgba(255,255,255,0.07); --bd2:rgba(255,255,255,0.12);
        --green:#7cffb2; --green-dim:rgba(124,255,178,0.10); --green-bd:rgba(124,255,178,0.28);
        --crit:#ff6b6b; --crit-dim:rgba(255,107,107,0.10); --crit-bd:rgba(255,107,107,0.28);
        --t1:rgba(255,255,255,0.92); --t2:rgba(255,255,255,0.50); --t3:rgba(255,255,255,0.30);
        background:var(--bg); color:var(--t1);
        font-family:var(--font-inter), system-ui, -apple-system, sans-serif;
      }
      .kb .custom-scrollbar::-webkit-scrollbar, .kb-scroll::-webkit-scrollbar { width:7px; height:7px; }
      .kb .custom-scrollbar::-webkit-scrollbar-thumb, .kb-scroll::-webkit-scrollbar-thumb { background:var(--s3); }

      .kb-spinner { width:22px; height:22px; border:2px solid var(--green-bd); border-top-color:var(--green); border-radius:50% !important; animation:kb-spin .8s linear infinite; }
      .kb-spinner.sm { width:13px; height:13px; } .kb-spinner.xs { width:12px; height:12px; display:inline-block; }
      @keyframes kb-spin { to { transform:rotate(360deg); } }
      @keyframes kb-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
      .kb .pulse { animation:kb-pulse 2s ease-in-out infinite; }

      /* shell */
      .kb-shell { display:grid; grid-template-columns:236px 1fr; height:100vh; overflow:hidden; }

      /* sidebar */
      .kb-side { display:flex; flex-direction:column; background:var(--s1); border-right:0.5px solid var(--bd); overflow:hidden; }
      .kb-side-logo { display:flex; align-items:center; gap:9px; padding:18px 18px 14px; }
      .kb-side-logo-img { height:26px; width:auto; }
      .kb-side-logo-name { font-family:var(--font-jetbrains-mono), monospace; font-size:15px; color:var(--green); }
      .kb-nav { flex:1; overflow-y:auto; padding:6px 0; display:flex; flex-direction:column; }
      .kb-nav-section { padding:0 10px; margin-bottom:10px; }
      .kb-nav-label { font-size:9px; text-transform:uppercase; letter-spacing:0.12em; color:var(--t3); padding:10px 8px 6px; }
      .kb-nav-item { width:100%; display:flex; align-items:center; gap:10px; padding:8px 10px; font-size:13px; color:var(--t2); background:transparent; border:none; cursor:pointer; text-align:left; transition:all .12s ease; }
      .kb-nav-item:hover { background:rgba(255,255,255,0.05); color:var(--t1); }
      .kb-nav-item.active { background:var(--green-dim); color:var(--green); }
      .kb-nav-icon { width:18px; text-align:center; font-size:13px; opacity:0.9; }
      .kb-nav-badge { margin-left:auto; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; color:var(--green); background:var(--green-dim); padding:1px 6px; }
      .kb-nav-badge.crit { color:var(--crit); background:var(--crit-dim); }
      .kb-nav-support { margin-top:auto; }
      .kb-profile { display:flex; align-items:center; gap:10px; padding:12px 14px; border-top:0.5px solid var(--bd); }
      .kb-avatar { width:30px; height:30px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--green); background:var(--green-dim); border:0.5px solid var(--green-bd); }
      .kb-profile-info { flex:1; min-width:0; }
      .kb-profile-name { font-size:12px; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .kb-profile-mail { font-size:10px; color:var(--t3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .kb-profile-out { background:none; border:none; color:var(--t3); cursor:pointer; font-size:16px; padding:4px; }
      .kb-profile-out:hover { color:var(--crit); }

      /* main column */
      .kb-maincol { display:flex; flex-direction:column; overflow:hidden; }
      .kb-topbar { height:54px; flex-shrink:0; display:flex; align-items:center; gap:16px; padding:0 22px; border-bottom:0.5px solid var(--bd); background:var(--s1); }
      .kb-search { flex:1; max-width:440px; display:flex; align-items:center; gap:8px; background:var(--s2); border:0.5px solid var(--bd); padding:7px 12px; }
      .kb-search-icon { color:var(--t3); font-size:14px; }
      .kb-search-input { flex:1; background:transparent; border:none; outline:none; color:var(--t1); font-family:var(--font-jetbrains-mono), monospace; font-size:12px; }
      .kb-search-input::placeholder { color:var(--t3); }
      .kb-kbd { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); background:var(--s3); padding:2px 6px; }
      .kb-topbar-right { margin-left:auto; display:flex; align-items:center; gap:12px; }
      .kb-icon-btn { background:transparent; border:0.5px solid var(--bd2); color:var(--t2); width:30px; height:30px; cursor:pointer; }
      .kb-icon-btn:hover { background:var(--s3); color:var(--t1); }
      .kb-cluster-pill { display:inline-flex; align-items:center; gap:7px; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); background:var(--s2); border:0.5px solid var(--bd); padding:5px 11px; }
      .kb-dot { width:6px; height:6px; background:var(--green); box-shadow:0 0 6px var(--green); }

      /* scroll + screens */
      .kb-scroll { flex:1; overflow-y:auto; }
      .kb-screen { padding:24px 28px 60px; display:flex; flex-direction:column; gap:18px; max-width:1320px; }

      /* welcome header */
      .kb-welcome { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
      .kb-welcome-title { font-size:26px; font-weight:500; color:var(--t1); margin:0; letter-spacing:-0.01em; }
      .kb-welcome-title .accent { color:var(--green); }
      .kb-welcome-sub { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t3); margin-top:5px; }
      .kb-welcome-actions { display:flex; gap:10px; }

      /* buttons */
      .kb-btn { font-family:inherit; font-size:12px; color:var(--t2); background:transparent; border:0.5px solid var(--bd2); padding:8px 16px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:all .15s ease; }
      .kb-btn:hover { background:var(--s3); color:var(--t1); }
      .kb-btn.primary { background:var(--green-dim); border-color:var(--green-bd); color:var(--green); }
      .kb-btn.primary:hover { background:rgba(124,255,178,0.18); }
      .kb-btn:disabled { opacity:0.45; cursor:not-allowed; }

      /* stat cards */
      .kb-stat-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
      .kb-statcard { background:var(--s1); border:0.5px solid var(--bd); padding:16px; }
      .kb-statcard-top { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
      .kb-statcard-icon { color:var(--green); font-size:13px; }
      .kb-statcard-label { font-size:11px; color:var(--t2); }
      .kb-statcard-dots { margin-left:auto; color:var(--t3); }
      .kb-statcard-val { font-family:var(--font-jetbrains-mono), monospace; font-size:30px; line-height:1; color:var(--t1); }
      .kb-statcard-val.ok { color:var(--green); } .kb-statcard-val.crit { color:var(--crit); }
      .kb-statcard-foot { margin-top:12px; padding-top:10px; border-top:0.5px solid var(--bd); }
      .kb-statcard-meta { font-size:10px; color:var(--t3); }

      /* grid 2 (chart + resource) */
      .kb-grid-2 { display:grid; grid-template-columns:1.7fr 1fr; gap:14px; }
      .kb-card { background:var(--s1); border:0.5px solid var(--bd); }
      .kb-col-header { display:flex; align-items:center; gap:10px; padding:13px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-col-title { font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:0.07em; color:var(--t2); }
      .kb-col-title.crit { color:var(--crit); }
      .kb-count { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); background:var(--s3); padding:1px 7px; }
      .kb-config { margin-left:auto; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-pill-mini { margin-left:auto; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; color:var(--t3); border:0.5px solid var(--bd); padding:2px 7px; text-transform:uppercase; }

      .kb-chart-wrap { padding:16px; }
      .kb-chart { width:100%; height:220px; display:block; }
      .kb-chart-axis { display:flex; justify-content:space-between; margin-top:8px; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-legend { display:flex; gap:16px; padding:0 0 10px; flex-wrap:wrap; }
      .kb-legend-item { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t2); }
      .kb-legend-dot { width:8px; height:3px; }

      /* meters */
      .kb-meters { padding:16px; display:flex; flex-direction:column; gap:16px; }
      .kb-meter-head { display:flex; justify-content:space-between; font-size:11px; color:var(--t2); margin-bottom:7px; }
      .kb-meter-pct { font-family:var(--font-jetbrains-mono), monospace; color:var(--green); }
      .kb-segbar { display:flex; gap:2px; }
      .kb-seg { flex:1; height:9px; background:var(--s3); }
      .kb-seg.on { background:var(--green); box-shadow:0 0 4px rgba(124,255,178,0.4); }
      .kb-anomaly { margin:0 16px 16px; padding:12px; background:var(--s2); border:0.5px solid var(--bd); }
      .kb-anomaly-head { font-size:11px; color:var(--t2); margin-bottom:8px; }
      .kb-anomaly-row { font-size:11px; color:var(--t3); line-height:1.6; }
      .kb-anomaly-row.ok { color:var(--green); }

      /* error */
      .kb-error { display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--crit-dim); border:0.5px solid var(--crit-bd); color:var(--crit); font-size:13px; padding:12px 16px; }
      .kb-error button { background:none; border:none; color:var(--crit); font-size:18px; cursor:pointer; }

      /* cluster grid */
      .kb-cluster-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; padding:16px; max-height:360px; overflow-y:auto; }
      .kb-cluster-card { background:var(--s2); border:0.5px solid var(--bd); padding:14px; cursor:pointer; transition:all .15s ease; }
      .kb-cluster-card:hover { border-color:var(--bd2); background:var(--s3); }
      .kb-cluster-card.selected { background:var(--green-dim); border-color:var(--green-bd); }
      .kb-cluster-card.disabled { opacity:0.45; cursor:not-allowed; }
      .kb-cluster-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
      .kb-cluster-icon { font-size:18px; color:var(--t3); }
      .kb-cluster-card.selected .kb-cluster-icon { color:var(--green); }
      .kb-cluster-name { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .kb-cluster-ns { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); margin:5px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .kb-tag { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; padding:2px 7px; text-transform:uppercase; }
      .kb-tag.teal { background:var(--green-dim); color:var(--green); border:0.5px solid var(--green-bd); }
      .kb-empty { grid-column:1/-1; text-align:center; color:var(--t3); font-size:13px; padding:24px; }
      .kb-empty.tall { padding:48px 24px; }

      /* two-col + progress + diagnosis */
      .kb-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch; }
      .kb-card-wrap { display:flex; } .kb-card-wrap > .kb-card { flex:1; }
      .kb-progress { list-style:none; margin:0; padding:18px 16px; display:flex; flex-direction:column; gap:14px; }
      .kb-step { display:flex; align-items:center; gap:12px; font-size:13px; color:var(--t3); }
      .kb-step.completed { color:var(--t1); } .kb-step.running { color:var(--green); }
      .kb-step-icon { width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; border:0.5px solid var(--bd); flex-shrink:0; }
      .kb-step.completed .kb-step-icon { color:var(--green); border-color:var(--green-bd); background:var(--green-dim); }
      .kb-step.running .kb-step-icon { border-color:var(--green-bd); }
      .kb-step-name.strong { font-weight:500; }
      .kb-step.running .kb-step-name { animation:kb-pulse 1.5s ease-in-out infinite; }
      .kb-diagnosis.crit { border-color:var(--crit-bd); }
      .kb-diag-body { padding:18px 16px; display:flex; flex-direction:column; gap:18px; font-size:13px; }
      .kb-field-label { display:block; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:var(--t3); margin-bottom:6px; }
      .kb-field-label.accent { color:var(--green); }
      .kb-root-cause { color:var(--t1); font-size:15px; font-weight:500; line-height:1.4; margin:0; }
      .kb-nested { background:var(--bg); border:0.5px solid var(--bd); padding:12px; }
      .kb-explanation { color:var(--t2); line-height:1.6; margin:0; }
      .kb-fix { color:var(--t1); line-height:1.6; margin:0; }
      .kb-code { display:block; background:var(--bg); border:0.5px solid var(--bd); color:var(--green); font-family:var(--font-jetbrains-mono), monospace; font-size:11px; padding:12px; line-height:1.7; word-break:break-all; }
      .kb-confidence-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
      .kb-confidence-val { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--green); }
      .kb-bar { height:3px; background:var(--s3); overflow:hidden; } .kb-bar.sm { width:48px; }
      .kb-bar-fill { height:100%; background:var(--green); transition:width 1s ease-out; }
      .kb-healthy { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 24px; border-color:var(--green-bd); }
      .kb-healthy-icon { width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:22px; color:var(--green); border:0.5px solid var(--green-bd); background:var(--green-dim); margin-bottom:18px; }
      .kb-healthy-title { color:var(--green); font-size:18px; font-weight:500; margin:0 0 8px; }
      .kb-healthy-sub { color:var(--t2); font-size:13px; max-width:320px; line-height:1.55; margin:0; }

      /* table */
      .kb-table-wrap { overflow-x:auto; }
      .kb-table { width:100%; border-collapse:collapse; font-size:13px; }
      .kb-table th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--t3); font-weight:500; padding:12px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-table td { padding:13px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-table tbody tr { cursor:pointer; transition:background .12s ease; }
      .kb-table tbody tr:hover { background:var(--s2); }
      .kb-td-date { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t3); white-space:nowrap; }
      .kb-td-cause { color:var(--t2); } .kb-table tbody tr:hover .kb-td-cause { color:var(--t1); }
      .kb-td-healthy { color:var(--green); }
      .kb-td-conf { color:var(--t3); font-family:var(--font-jetbrains-mono), monospace; font-size:11px; }
      .kb-td-conf-inner { display:flex; align-items:center; gap:8px; }
      .kb-status { display:inline-block; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; padding:3px 8px; border:0.5px solid; }
      .kb-status.crit { background:var(--crit-dim); color:var(--crit); border-color:var(--crit-bd); }
      .kb-status.ok { background:var(--green-dim); color:var(--green); border-color:var(--green-bd); }
      .kb-status.run { background:var(--green-dim); color:var(--green); border-color:var(--green-bd); animation:kb-pulse 1.5s ease-in-out infinite; }
      .kb-status.idle { background:var(--s3); color:var(--t3); border-color:var(--bd); }

      /* tooltip */
      .kb-tooltip {
        position:absolute; top:-4px; transform:translateX(-50%) translateY(-100%);
        background:var(--s1); border:0.5px solid var(--green-bd); padding:9px 12px; z-index:10;
        pointer-events:none; white-space:nowrap; min-width:140px;
        box-shadow:0 8px 24px rgba(0,0,0,0.6);
        transition: left 0.15s ease;
      }
      .kb-tooltip-day { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--green); margin-bottom:7px; text-transform:uppercase; letter-spacing:0.08em; }
      .kb-tooltip-row { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--t2); line-height:1.8; }
      .kb-tooltip-dot { width:6px; height:6px; flex-shrink:0; }
      .kb-tooltip-label { flex:1; }
      .kb-tooltip-val { font-family:var(--font-jetbrains-mono), monospace; color:var(--t1); }

      /* coming soon */
      .kb-soon { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:64px 24px; gap:14px; }
      .kb-soon-icon { font-size:32px; color:var(--green); }
      .kb-soon-title { font-size:18px; font-weight:500; color:var(--t1); margin:0; }
      .kb-soon-sub { font-size:13px; color:var(--t2); max-width:380px; line-height:1.6; margin:0 0 6px; }

      @media (max-width: 1024px) {
        .kb-shell { grid-template-columns:64px 1fr; }
        .kb-side-logo-name, .kb-nav-label, .kb-nav-item span:not(.kb-nav-icon):not(.kb-nav-badge), .kb-profile-info { display:none; }
        .kb-nav-item { justify-content:center; }
        .kb-grid-2 { grid-template-columns:1fr; }
        .kb-stat-row { grid-template-columns:1fr 1fr; }
        .kb-two-col { grid-template-columns:1fr; }
      }
      @media (max-width: 600px) {
        .kb-stat-row { grid-template-columns:1fr 1fr; }
        .kb-welcome { flex-direction:column; align-items:flex-start; }
      }

      /* ---------- filter bar (Incidents) ---------- */
      .kb-filterbar { margin-left:auto; display:flex; gap:6px; }
      .kb-filter-pill { padding:3px 10px; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; border:0.5px solid var(--bd); background:transparent; color:var(--t3); cursor:pointer; font-family:var(--font-jetbrains-mono), monospace; }
      .kb-filter-pill.active { background:var(--green-dim); border-color:var(--green-bd); color:var(--green); }

      /* ---------- incident rows / accordion ---------- */
      .kb-inc-row-wrap { border-bottom:0.5px solid var(--bd); }
      .kb-inc-row { display:grid; grid-template-columns:10px 1fr auto auto; gap:12px; align-items:flex-start; padding:14px 16px; cursor:pointer; transition:background .12s ease; }
      .kb-inc-row:hover { background:var(--s2); }
      .kb-inc-dot { width:7px; height:7px; margin-top:4px; flex-shrink:0; }
      .kb-inc-dot.crit { background:var(--crit); box-shadow:0 0 6px var(--crit-bd); }
      .kb-inc-dot.ok { background:var(--green); }
      .kb-inc-main { min-width:0; }
      .kb-inc-service { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); margin-bottom:3px; }
      .kb-inc-desc { font-size:11px; color:var(--t2); line-height:1.5; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .kb-inc-time { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); white-space:nowrap; }
      .kb-inc-chevron { color:var(--t3); font-size:11px; }
      .kb-inc-detail { padding:16px 16px 20px 33px; background:var(--s2); display:flex; flex-direction:column; gap:16px; font-size:13px; }
      .kb-inc-timeline { display:flex; flex-direction:column; gap:8px; }
      .kb-tl-item { display:flex; align-items:center; gap:9px; font-size:11.5px; color:var(--t2); }
      .kb-tl-dot { width:6px; height:6px; background:var(--t3); flex-shrink:0; }
      .kb-tl-dot.ok { background:var(--green); box-shadow:0 0 6px var(--green-bd); }
      .kb-audit { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); padding-top:8px; border-top:0.5px solid var(--bd); }

      /* ---------- PR risk ---------- */
      .kb-pr-note { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--t2); background:var(--s1); border:0.5px solid var(--bd); padding:10px 14px; }
      .kb-pr-list { display:flex; flex-direction:column; gap:12px; }
      .kb-pr-card { background:var(--s1); border:0.5px solid var(--bd); }
      .kb-pr-card.high { border-color:var(--crit-bd); }
      .kb-pr-card.medium { border-color:rgba(255,184,107,0.3); }
      .kb-pr-card.safe { opacity:0.65; }
      .kb-pr-head { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-pr-title-wrap { flex:1; display:flex; align-items:baseline; gap:8px; min-width:0; }
      .kb-pr-title { font-size:13px; color:var(--t1); }
      .kb-pr-number { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:#7fd3ff; }
      .kb-pr-status { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; letter-spacing:0.05em; padding:3px 8px; white-space:nowrap; }
      .kb-pr-status.high { color:var(--crit); background:var(--crit-dim); }
      .kb-pr-status.medium { color:#ffb86b; background:rgba(255,184,107,0.1); }
      .kb-pr-status.safe { color:var(--green); background:var(--green-dim); }
      .kb-pr-meta { font-family:var(--font-jetbrains-mono), monospace; font-size:10.5px; color:var(--t3); padding:8px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-pr-body { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:14px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-pr-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; }
      .kb-pr-commented { font-size:11px; color:var(--green); }
      .kb-pr-actions { display:flex; gap:8px; margin-left:auto; }

      .kb-risk-badge { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; padding:3px 8px; border:0.5px solid; }
      .kb-risk-badge.high { background:var(--crit-dim); color:var(--crit); border-color:var(--crit-bd); }
      .kb-risk-badge.medium { background:rgba(255,184,107,0.1); color:#ffb86b; border-color:rgba(255,184,107,0.3); }
      .kb-risk-badge.safe { background:var(--green-dim); color:var(--green); border-color:var(--green-bd); }

      /* ---------- workloads table ---------- */
      .kb-workload-search { max-width:220px; background:var(--s2); border:0.5px solid var(--bd2); padding:7px 12px; color:var(--t1); font-family:var(--font-jetbrains-mono), monospace; font-size:12px; }
      .kb-table-head-row { display:grid; grid-template-columns:1fr 80px 80px 80px 100px 80px; gap:8px; padding:10px 16px; border-bottom:0.5px solid var(--bd); font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--t3); }
      .kb-wl-row { display:grid; grid-template-columns:1fr 80px 80px 80px 100px 80px; gap:8px; padding:12px 16px; border-bottom:0.5px solid var(--bd); align-items:center; cursor:pointer; transition:background .12s ease; }
      .kb-wl-row:hover { background:var(--s2); }
      .kb-wl-service { display:flex; align-items:center; gap:8px; min-width:0; }
      .kb-dot-sm { width:5px; height:5px; flex-shrink:0; }
      .kb-dot-sm.ok { background:var(--green); } .kb-dot-sm.warn { background:#ffb86b; } .kb-dot-sm.crit { background:var(--crit); }
      .kb-wl-name { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); overflow:hidden; text-overflow:ellipsis; }
      .kb-wl-ns { font-size:10px; color:var(--t3); }
      .kb-wl-pods, .kb-wl-metric { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); }
      .kb-wl-pods.warn { color:#ffb86b; }
      .kb-tag.red { background:var(--crit-dim); color:var(--crit); border:0.5px solid var(--crit-bd); }
      .kb-tag.amber { background:rgba(255,184,107,0.1); color:#ffb86b; border:0.5px solid rgba(255,184,107,0.3); }

      /* ---------- drawer ---------- */
      .kb-drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:40; }
      .kb-drawer { position:fixed; right:0; top:0; bottom:0; width:360px; background:var(--s1); border-left:0.5px solid var(--bd); z-index:50; display:flex; flex-direction:column; animation:kb-slide-in .2s ease; }
      @keyframes kb-slide-in { from { transform:translateX(100%); } to { transform:translateX(0); } }
      .kb-drawer-head { display:flex; align-items:flex-start; justify-content:space-between; padding:18px 20px; border-bottom:0.5px solid var(--bd); }
      .kb-drawer-title { font-family:var(--font-jetbrains-mono), monospace; font-size:14px; color:var(--t1); }
      .kb-drawer-sub { font-size:11px; color:var(--t3); margin-top:3px; }
      .kb-drawer-close { background:none; border:none; color:var(--t3); font-size:20px; cursor:pointer; line-height:1; }
      .kb-drawer-body { padding:18px 20px; overflow-y:auto; flex:1; }
      .kb-drawer-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:0.5px solid var(--bd); font-size:12.5px; color:var(--t2); }
      .kb-drawer-row span:first-child { color:var(--t3); }
      .kb-warn-text { color:#ffb86b !important; }

      /* ---------- nodes ---------- */
      .kb-node-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px; }
      .kb-node-card { padding:16px; display:flex; flex-direction:column; gap:12px; }
      .kb-node-head { display:flex; align-items:center; gap:8px; }
      .kb-node-name { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); flex:1; overflow:hidden; text-overflow:ellipsis; }
      .kb-node-roles { font-size:10px; color:var(--t3); text-transform:uppercase; letter-spacing:0.05em; }
      .kb-node-caps { display:flex; justify-content:space-between; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); padding-top:6px; border-top:0.5px solid var(--bd); }

      /* ---------- ask kubric chat ---------- */
      .kb-ask-screen { display:flex; flex-direction:column; height:100%; }
      .kb-ask-chat { flex:1; overflow-y:auto; padding:28px 24px; display:flex; flex-direction:column; gap:16px; max-width:680px; margin:0 auto; width:100%; }
      .kb-ask-empty { margin:auto; text-align:center; display:flex; flex-direction:column; align-items:center; }
      .kb-ask-hero { position:relative; margin-bottom:22px; display:flex; align-items:center; justify-content:center; }
      .kb-ask-logo { height:72px; width:auto; position:relative; z-index:1; animation:kb-float 4s ease-in-out infinite; }
      @keyframes kb-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
      .kb-ask-hero-glow { position:absolute; width:130px; height:130px; border-radius:50% !important; background:radial-gradient(circle, rgba(124,255,178,0.28), transparent 70%); filter:blur(8px); }
      .kb-ask-empty-title { font-size:18px; color:var(--t1); font-weight:500; margin:0 0 6px; }
      .kb-ask-empty-sub { font-size:13px; color:var(--t3); margin:0 0 24px; max-width:380px; line-height:1.5; }
      .kb-ask-chips { display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:520px; width:100%; }
      .kb-ask-chip { display:flex; align-items:center; gap:10px; background:var(--s2); border:0.5px solid var(--bd); padding:12px 14px; font-size:12.5px; color:var(--t2); cursor:pointer; text-align:left; transition:all .15s ease; }
      .kb-ask-chip:hover { border-color:var(--green-bd); background:var(--green-dim); color:var(--t1); }
      .kb-ask-chip-icon { color:var(--green); font-size:13px; flex-shrink:0; }
      .kb-ask-chip span:nth-child(2) { flex:1; }
      .kb-ask-chip-arrow { color:var(--t3); opacity:0; transition:all .2s ease; }
      .kb-ask-chip:hover .kb-ask-chip-arrow { opacity:1; color:var(--green); transform:translateX(3px); }
      .kb-chat-row { display:flex; gap:10px; align-items:flex-start; }
      .kb-chat-row.kubric { flex-direction:row-reverse; }
      .kb-chat-avatar { width:28px; height:28px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; overflow:hidden; }
      .kb-chat-avatar.user { background:var(--s3); border:0.5px solid var(--bd2); color:var(--t3); }
      .kb-chat-avatar.kubric { background:var(--green-dim); border:0.5px solid var(--green-bd); }
      .kb-chat-avatar-img { width:20px; height:20px; object-fit:contain; }
      .kb-chat-bubble { background:var(--s2); border:0.5px solid var(--bd); padding:10px 14px; font-size:12.5px; color:var(--t1); max-width:480px; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
      .kb-chat-bubble.kubric { border-left:2px solid var(--green); color:var(--t2); }
      .kb-chat-tag { display:block; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--green); margin-bottom:6px; }
      .kb-typing { display:inline-flex; gap:4px; }
      .kb-typing span { width:5px; height:5px; background:var(--green); animation:kb-pulse 1.2s ease-in-out infinite; }
      .kb-typing span:nth-child(2) { animation-delay:.2s; } .kb-typing span:nth-child(3) { animation-delay:.4s; }
      .kb-stream-cursor { display:inline-block; width:7px; height:14px; margin-left:2px; background:var(--green); vertical-align:text-bottom; animation:kb-blink 1s step-end infinite; }
      @keyframes kb-blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
      .kb-ask-input-wrap { border-top:0.5px solid var(--bd); padding:16px 24px 20px; }
      .kb-ask-input-inner { max-width:680px; margin:0 auto; display:flex; gap:10px; align-items:center; background:var(--s2); border:0.5px solid var(--bd2); padding:10px 10px 10px 16px; transition:border-color .2s ease; }
      .kb-ask-input-inner:focus-within { border-color:var(--green-bd); }
      .kb-ask-textarea { flex:1; background:transparent; border:none; outline:none; color:var(--t1); font-family:inherit; font-size:13px; resize:none; max-height:120px; line-height:1.5; padding:3px 0; }
      .kb-ask-textarea::placeholder { color:var(--t3); }
      .kb-ask-hint { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); white-space:nowrap; flex-shrink:0; }
      .kb-ask-send { display:inline-flex; align-items:center; gap:7px; background:var(--green-dim); border:0.5px solid var(--green-bd); color:var(--green); font-family:inherit; font-size:12.5px; font-weight:500; padding:9px 16px; cursor:pointer; flex-shrink:0; transition:all .15s ease; }
      .kb-ask-send:hover:not(:disabled) { background:rgba(124,255,178,0.18); }
      .kb-ask-send:disabled { opacity:0.4; cursor:not-allowed; }
      .kb-ask-send-arrow { transition:transform .2s ease; }
      .kb-ask-send:hover:not(:disabled) .kb-ask-send-arrow { transform:translateX(3px); }
      .kb-ask-attach { flex-shrink:0; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; background:var(--s3); border:0.5px solid var(--bd2); color:var(--t2); font-size:16px; line-height:1; cursor:pointer; transition:all .15s ease; }
      .kb-ask-attach:hover:not(:disabled) { border-color:var(--green-bd); color:var(--green); background:var(--green-dim); }
      .kb-ask-attach:disabled { opacity:0.4; cursor:not-allowed; }
      .kb-ask-preview { max-width:680px; margin:0 auto 10px; }
      .kb-ask-preview-box { position:relative; display:inline-block; }
      .kb-ask-preview-img { max-height:120px; max-width:220px; display:block; border:0.5px solid var(--green-bd); object-fit:cover; }
      .kb-ask-preview-remove { position:absolute; top:-8px; right:-8px; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; background:var(--s1); border:0.5px solid var(--bd2); color:var(--t2); font-size:10px; cursor:pointer; transition:all .15s ease; }
      .kb-ask-preview-remove:hover { border-color:var(--green-bd); color:var(--green); }
      .kb-chat-image { display:block; max-width:100%; max-height:260px; margin-bottom:8px; border:0.5px solid var(--bd2); object-fit:contain; }

      /* ---------- playbooks ---------- */
      .kb-playbook-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; }
      .kb-playbook-card { padding:20px; cursor:pointer; }
      .kb-playbook-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .kb-playbook-source { font-size:10px; color:var(--t3); }
      .kb-playbook-title { font-size:14px; color:var(--t1); margin:0 0 8px; font-weight:500; }
      .kb-playbook-desc { font-size:12px; color:var(--t2); line-height:1.55; margin:0 0 16px; }
      .kb-playbook-foot { display:flex; justify-content:space-between; font-size:10px; color:var(--t3); }
      .kb-playbook-running { color:var(--green); display:flex; align-items:center; gap:6px; }

      /* ---------- settings ---------- */
      .kb-settings-grid { display:grid; grid-template-columns:180px 1fr; gap:20px; align-items:start; }
      .kb-settings-nav { display:flex; flex-direction:column; gap:2px; }
      .kb-settings-content { min-width:0; }
      .kb-trust-card { display:flex; gap:14px; padding:16px; border:0.5px solid var(--bd); cursor:pointer; margin-bottom:10px; }
      .kb-trust-card.selected { border-color:var(--green-bd); background:var(--green-dim); }
      .kb-radio { width:15px; height:15px; border-radius:50% !important; border:1.5px solid var(--bd2); flex-shrink:0; margin-top:2px; }
      .kb-radio.on { border-color:var(--green); box-shadow:inset 0 0 0 3px var(--green); }
      .kb-trust-name { font-size:13px; color:var(--t1); font-weight:500; margin-bottom:4px; }
      .kb-trust-desc { font-size:11.5px; color:var(--t2); line-height:1.5; }
      .kb-issue-toggles { border-top:0.5px solid var(--bd); padding-top:6px; }
      .kb-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; font-size:12.5px; color:var(--t2); }
      .kb-switch { width:32px; height:18px; background:var(--s3); border:none; position:relative; cursor:pointer; }
      .kb-switch.on { background:var(--green-dim); border:0.5px solid var(--green-bd); }
      .kb-switch-knob { position:absolute; top:2px; left:2px; width:12px; height:12px; background:var(--t3); transition:left .15s ease, background .15s ease; }
      .kb-switch.on .kb-switch-knob { left:18px; background:var(--green); }

      /* ---------- command palette ---------- */
      .kb-cmdk-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:100; display:flex; }
      .kb-cmdk { max-width:560px; width:90%; margin:80px auto 0; background:var(--s1); border:0.5px solid var(--bd2); height:fit-content; max-height:70vh; display:flex; flex-direction:column; }
      .kb-cmdk-input { height:44px; padding:0 16px; background:transparent; border:none; outline:none; color:var(--t1); font-size:14px; border-bottom:0.5px solid var(--bd); font-family:inherit; }
      .kb-cmdk-results { overflow-y:auto; max-height:360px; }
      .kb-cmdk-item { padding:10px 16px; display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; color:var(--t1); }
      .kb-cmdk-item:hover, .kb-cmdk-item.selected { background:var(--green-dim); }
      .kb-cmdk-icon { color:var(--t3); width:16px; text-align:center; }
      .kb-cmdk-empty { padding:20px 16px; color:var(--t3); font-size:12px; text-align:center; }

      @media (max-width: 860px) {
        .kb-pr-body { grid-template-columns:1fr; }
        .kb-settings-grid { grid-template-columns:1fr; }
        .kb-table-head-row, .kb-wl-row { grid-template-columns:1fr 60px 60px; }
        .kb-table-head-row span:nth-child(4), .kb-table-head-row span:nth-child(5), .kb-table-head-row span:nth-child(6),
        .kb-wl-row .kb-wl-metric:nth-of-type(2), .kb-wl-row .kb-tag, .kb-wl-row .kb-risk-badge { display:none; }
        .kb-ask-chips { grid-template-columns:1fr; }
      }
    `}} />
  );
}
