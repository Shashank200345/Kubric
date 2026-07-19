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

interface SuggestedAction {
  action_type: string;
  params: Record<string, unknown>;
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
  suggested_action: SuggestedAction | null;
  confidence: number | null;
  evidence_used: string[] | null;
  created_at: string;
}

interface PodRow {
  namespace: string;
  name: string;
  status: string;
  restarts: number;
  cpu: string;
  memory: string;
}

interface ActionUpdate {
  status?: 'idle' | 'pending' | 'success' | 'failed';
  output?: unknown;
}

type SessionUser = { id: string; email?: string;[key: string]: unknown };
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
  const [clusterMenuOpen, setClusterMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [liveMetrics, setLiveMetrics] = useState({ cpu_pct: 0, memory_pct: 0, disk_pct: 0, network_pct: 0, node_count: 0, pod_count: 0 });

  const [commandStatus, setCommandStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [troubleshootModalOpen, setTroubleshootModalOpen] = useState(false);
  const [podsListModalOpen, setPodsListModalOpen] = useState(false);
  const [allPods, setAllPods] = useState<PodRow[]>([]);
  const [podsSearch, setPodsSearch] = useState('');

  const channelRef = useRef<string | null>(null);
  const clusterMenuRef = useRef<HTMLDivElement>(null);

  const fetchClusters = async () => {
    try {
      const res = await fetch(`${API_BASE}/clusters`);
      if (res.ok) {
        const data = await res.json();
        const nextClusters: string[] = data.clusters || [];
        setClusters(nextClusters);
        setSelectedCluster(current => current && nextClusters.includes(current) ? current : (nextClusters[0] || ''));
      }
    } catch (e) {
      console.error("Failed to fetch clusters", e);
    }
  };

  const fetchAllPods = async () => {
    try {
      const context = selectedCluster ? `?context=${encodeURIComponent(selectedCluster)}` : '';
      const res = await fetch(`${API_BASE}/pods${context}`);
      if (res.ok) {
        const data = await res.json();
        setAllPods(data.pods || []);
      }
    } catch (e) {
      console.error("Failed to fetch pods", e);
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
    insforge.realtime.subscribe('investigations:all');
    insforge.realtime.on('investigations_updated', () => {
      fetchHistory();
    });

    insforge.realtime.subscribe('actions:all');
    insforge.realtime.on('actions_updated', (msg: { payload?: ActionUpdate }) => {
      const payload = msg.payload;
      if (payload && payload.status) {
        setCommandStatus(payload.status);
        // Sometimes output is a JSON object with error/message, stringify it for display
        if (payload.output) {
          if (typeof payload.output === 'object') {
            setCommandOutput(JSON.stringify(payload.output, null, 2));
          } else {
            setCommandOutput(String(payload.output));
          }
        }
      }
    });

    return () => {
      insforge.realtime.unsubscribe('investigations:all');
      insforge.realtime.unsubscribe('actions:all');
    };
  }, []);

  const handleRunInvestigation = async () => {
    if (!selectedCluster) {
      setError("Please select a cluster first.");
      return;
    }
    
    setError(null);
    setProgressSteps([]);
    setCommandStatus('idle');
    setCommandOutput(null);
    
    const newInvId = 'inv_' + Math.random().toString(36).substring(2, 9);
    const newInv = {
      id: newInvId,
      status: 'running',
      created_at: new Date().toISOString(),
      cluster_context: selectedCluster
    } as Investigation;
    
    setCurrentInvestigation(newInv);
    setIsInvestigating(true);
    setInvestigations(prev => [newInv, ...prev]);
    
    try {
      const authHeader = insforge.getHttpClient().getHeaders()['Authorization'];
      const token = authHeader ? authHeader.replace('Bearer ', '') : null;
      const res = await fetch(`${API_BASE}/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ investigation_id: newInvId, cluster_context: selectedCluster })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `Server returned ${res.status}`);
      }

      // The backend runs the investigation synchronously and returns the diagnosis.
      const data = await res.json();
      const diag = data.diagnosis || {};
      const realId: string | undefined = data.investigation_id || undefined;

      const completed: Investigation = {
        ...newInv,
        id: realId || newInv.id,
        status: 'completed',
        root_cause: diag.root_cause ?? null,
        explanation: diag.explanation ?? null,
        fix: diag.fix ?? diag.suggested_fix ?? null,
        kubectl_command: diag.kubectl_command ?? null,
        suggested_action: diag.suggested_action ?? null,
        confidence: diag.confidence ?? null,
        evidence_used: diag.evidence_used ?? null,
      };
      setCurrentInvestigation(completed);

      // Populate the progress checklist for the persisted run (marks steps done).
      if (realId) {
        try {
          const pRes = await fetch(`${API_BASE}/investigate/${realId}/progress`);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData.progress) setProgressSteps(pData.progress as ProgressStep[]);
          }
        } catch { /* progress is best-effort */ }
      }

      fetchHistory();
    } catch (e: unknown) {
      console.error("Investigation failed", e);
      setError(e instanceof Error ? e.message : "Failed to run investigation.");
      setCurrentInvestigation(prev => prev ? { ...prev, status: 'failed' } : null);
    } finally {
      setIsInvestigating(false);
    }
  };

  const handleApproveFix = async () => {
    if (!currentInvestigation || !currentInvestigation.suggested_action || !user) return;
    setCommandStatus('pending');
    setCommandOutput(null);

    const authHeader = insforge.getHttpClient().getHeaders()['Authorization'];
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      setError('Not authenticated.');
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
          investigation_id: currentInvestigation.id,
          action_type: currentInvestigation.suggested_action.action_type,
          params: currentInvestigation.suggested_action.params
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to dispatch fix to cluster.');
      }
    } catch (e: unknown) {
      console.error('Failed to run fix:', e);
      setError(e instanceof Error ? e.message : 'Failed to dispatch fix to cluster.');
      setCommandStatus('failed');
    }
  };

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

  // Poll live metrics every 5s for the active cluster
  useEffect(() => {
    let active = true;
    let consecutiveFailures = 0;

    const poll = async () => {
      if (consecutiveFailures >= 3) return;
      try {
        const context = selectedCluster ? `?context=${encodeURIComponent(selectedCluster)}` : '';
        const res = await fetch(`${API_BASE}/metrics${context}`);
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
  }, [selectedCluster]);

  // Global keyboard controls and menu dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen(true);
      }
      if (e.key === 'Escape') {
        setClusterMenuOpen(false);
        setSidebarOpen(false);
        setPodsListModalOpen(false);
        setTroubleshootModalOpen(false);
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (clusterMenuRef.current && !clusterMenuRef.current.contains(e.target as Node)) {
        setClusterMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
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

  const currentScreenLabel = NAV.flatMap(section => section.items).find(item => item.id === activeScreen)?.label
    || (activeScreen === 'settings' ? 'Settings' : 'Dashboard');
  const navigateTo = (screen: string) => {
    setActiveScreen(screen);
    setSidebarOpen(false);
    setClusterMenuOpen(false);
  };

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
    <>
      <div className="kb">
        <KubricStyles />
        <div className="kb-shell">

          {sidebarOpen && <button className="kb-side-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

          {/* ========== SIDEBAR ========== */}
          <aside className={`kb-side ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
            <div className="kb-side-logo">
              <img src="/kubric-logo.png" alt="" className="kb-side-logo-img" />
              <span className="kb-side-logo-name"><span style={{ color: '#7cffb2' }}>K</span><span style={{ color: '#f4f7f9' }}>UBRIC</span></span>
              <span className="kb-side-plan">Console</span>
            </div>

            <nav className="kb-nav">
              {NAV.map(section => (
                <div key={section.group} className="kb-nav-section">
                  <div className="kb-nav-label">{section.group}</div>
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      className={`kb-nav-item ${activeScreen === item.id ? 'active' : ''}`}
                      onClick={() => navigateTo(item.id)}
                      aria-current={activeScreen === item.id ? 'page' : undefined}
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
                <button className={`kb-nav-item ${activeScreen === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')} aria-current={activeScreen === 'settings' ? 'page' : undefined}>
                  <span className="kb-nav-icon">⚙</span> Settings
                </button>
                <button className="kb-nav-item" onClick={() => navigateTo('ask')}>
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
              <button className="kb-mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
              <div className="kb-topbar-context">
                <span>Workspace</span>
                <strong>{currentScreenLabel}</strong>
              </div>
              <button className="kb-search" onClick={() => setCmdkOpen(true)} aria-label="Open command palette">
                <span className="kb-search-icon">⌕</span>
                <span className="kb-search-copy">Search clusters, incidents, or ask anything…</span>
                <span className="kb-kbd">⌘K</span>
              </button>
              <div className="kb-topbar-right">
                <button className="kb-icon-btn" onClick={() => window.location.reload()} title="Reload dashboard" aria-label="Reload dashboard">↻</button>
                <div className="kb-cluster-switch" ref={clusterMenuRef}>
                  <button
                    className="kb-cluster-pill"
                    onClick={() => setClusterMenuOpen(o => !o)}
                    title="Switch cluster"
                    aria-expanded={clusterMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="kb-dot pulse" />
                    {selectedCluster || 'no cluster'}
                    <span className="kb-cluster-caret">▾</span>
                  </button>
                  {clusterMenuOpen && (
                    <div className="kb-cluster-menu">
                      {clusters.length === 0 && <div className="kb-cluster-menu-empty">No clusters</div>}
                      {clusters.map(c => (
                        <button
                          key={c}
                          className={`kb-cluster-menu-item ${c === selectedCluster ? 'active' : ''}`}
                          onClick={() => { setSelectedCluster(c); setClusterMenuOpen(false); }}
                        >
                          <span className="kb-dot" />{c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="kb-scroll" style={(podsListModalOpen || troubleshootModalOpen || cmdkOpen) ? { overflow: 'hidden' } : {}}>

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
                      <span className="kb-agent-status">
                        <span className="kb-dot pulse" />
                        Agent active
                      </span>
                      <button className="kb-btn primary" onClick={() => navigateTo('troubleshoot')}>Run investigation →</button>
                    </div>
                  </div>

                  {/* stat cards */}
                  <div className="kb-stat-row">
                    {[
                      { id: 'nodes', icon: '⬡', label: 'Nodes', val: liveMetrics.node_count || clusters.length, meta: 'active in cluster', tone: '' },
                      { id: 'pods', icon: '◎', label: 'Pods running', val: liveMetrics.pod_count, meta: 'across all namespaces', tone: liveMetrics.pod_count > 0 ? 'ok' : '' },
                      { id: 'incidents', icon: '△', label: 'Issues found', val: issuesFound, meta: 'root causes identified', tone: issuesFound > 0 ? 'crit' : 'ok' },
                      { id: 'troubleshoot', icon: '✓', label: 'Investigations', val: investigations.length, meta: `${healthyRuns} healthy · ${issuesFound} issues`, tone: '' },
                    ].map(s => (
                      <button
                        type="button"
                        key={s.id}
                        className="kb-statcard kb-statcard-clickable"
                        onClick={() => {
                          if (s.id === 'pods') {
                            setPodsSearch('');
                            setAllPods([]);
                            fetchAllPods();
                            setPodsListModalOpen(true);
                          } else {
                            navigateTo(s.id);
                          }
                        }}
                      >
                        <div className="kb-statcard-top">
                          <span className="kb-statcard-icon">{s.icon}</span>
                          <span className="kb-statcard-label">{s.label}</span>
                          <span className="kb-statcard-dots">↗</span>
                        </div>
                        <div className={`kb-statcard-val ${s.tone}`}>{s.val}</div>
                        <div className="kb-statcard-foot">
                          <span className="kb-statcard-meta">{s.meta}</span>
                        </div>
                      </button>
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
                                <td>{inv.cluster_context ? <span className="kb-cluster-pill"><span className="kb-dot"></span>{inv.cluster_context}</span> : <span style={{ color: 'var(--t3)' }}>—</span>}</td>
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
                    <div className="kb-welcome-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="kb-agent-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 500 }}>
                        <span className="kb-dot pulse" style={{ background: '#38bdf8' }}></span>
                        Agent active
                      </span>
                      <button className="kb-btn primary" onClick={handleRunInvestigation} disabled={isInvestigating || !selectedCluster}>
                        {isInvestigating ? <><span className="kb-spinner xs" /> Scanning...</> : 'Scan Cluster'}
                      </button>
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
                              // A finished investigation means every scan step ran.
                              state = 'completed';
                            } else if (currentInvestigation.status === 'failed') {
                              state = isStepInProgress ? 'completed' : 'pending';
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
                          <li className={`kb-step ${currentInvestigation.status === 'completed' ? 'completed' : 'pending'}`}>
                            <span className="kb-step-icon">{currentInvestigation.status === 'completed' ? '✓' : '○'}</span>
                            <span className="kb-step-name strong">{currentInvestigation.status === 'completed' ? (currentInvestigation.root_cause ? 'Root cause found' : 'Analysis complete') : 'Root cause found'}</span>
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
                                {currentInvestigation.suggested_action ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                                    <span className="kb-field-label">Action</span>
                                    <code className="kb-code">
                                      {currentInvestigation.suggested_action.action_type}
                                      <br />
                                      <span style={{ color: 'var(--t3)', fontSize: '0.85em' }}>
                                        {JSON.stringify(currentInvestigation.suggested_action.params)}
                                      </span>
                                    </code>

                                    {commandStatus === 'idle' && (
                                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                        <button className="kb-btn" style={{ background: '#10b981', color: 'white', border: 'none' }} onClick={handleApproveFix}>
                                          Approve & Run Fix
                                        </button>
                                        <button className="kb-btn" style={{ background: 'var(--s3)', color: 'var(--t1)', border: '1px solid var(--bd)' }} onClick={() => setTroubleshootModalOpen(true)}>
                                          Troubleshoot Manually
                                        </button>
                                      </div>
                                    )}
                                    {commandStatus === 'pending' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', color: 'var(--t2)' }}>
                                        <span className="kb-spinner xs" />
                                        Waiting for cluster agent to execute...
                                      </div>
                                    )}
                                    {commandStatus === 'success' && (
                                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '6px' }}>
                                        <div style={{ color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>✓ Fix applied successfully</div>
                                        <pre style={{ margin: 0, fontSize: '12px', color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{commandOutput}</pre>
                                      </div>
                                    )}
                                    {commandStatus === 'failed' && (
                                      <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px' }}>
                                        <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>✗ Fix failed</div>
                                        <pre style={{ margin: 0, fontSize: '12px', color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{commandOutput}</pre>
                                        <button className="kb-btn" style={{ marginTop: '8px' }} onClick={() => setCommandStatus('idle')}>Try again</button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', marginTop: '16px' }}>
                                    <button className="kb-btn" style={{ background: 'var(--s3)', color: 'var(--t1)', border: '1px solid var(--bd)' }} onClick={() => setTroubleshootModalOpen(true)}>
                                      Troubleshoot Manually
                                    </button>
                                  </div>
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
                                <td>{inv.cluster_context ? <span className="kb-cluster-pill"><span className="kb-dot"></span>{inv.cluster_context}</span> : <span style={{ color: 'var(--t3)' }}>—</span>}</td>
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
              {activeScreen === 'incidents' && <IncidentsScreen selectedCluster={selectedCluster} />}

              {/* ============ PR RISK ============ */}
              {activeScreen === 'prrisk' && <PRRiskScreen />}

              {/* ============ WORKLOADS ============ */}
              {activeScreen === 'workloads' && <WorkloadsScreen selectedCluster={selectedCluster} />}

              {/* ============ NODES ============ */}
              {activeScreen === 'nodes' && <NodesScreen selectedCluster={selectedCluster} />}

              {/* ============ ASK KUBRIC ============ */}
              {activeScreen === 'ask' && <AskKubricScreen selectedCluster={selectedCluster} initials={initials} />}

              {/* ============ PLAYBOOKS ============ */}
              {activeScreen === 'playbooks' && <PlaybooksScreen />}

              {/* ============ SETTINGS ============ */}
              {activeScreen === 'settings' && <SettingsScreen user={user} selectedCluster={selectedCluster} clusters={clusters} fetchClusters={fetchClusters} />}

            </div>
          </div>
        </div>
      </div>

      {/* Modals placed outside of animated containers to guarantee correct fixed positioning */}
      {/* Pods List Modal */}
      {podsListModalOpen && (
        <div className="kb-modal-backdrop kb-pods-backdrop" onClick={() => setPodsListModalOpen(false)}>
          <div className="kb-modal kb-pods-modal" onClick={e => e.stopPropagation()}>
            <div className="kb-pods-accent" />
            <div className="kb-modal-header kb-pods-header">
              <div className="kb-pods-heading">
                <span className="kb-pods-eyebrow">Cluster workloads</span>
                <div className="kb-pods-titlewrap">
                  <h2 className="kb-modal-title">All Pods</h2>
                  {allPods.length > 0 && <span className="kb-pods-count">{allPods.length}</span>}
                </div>
                <span className="kb-pods-cluster">{selectedCluster || 'No cluster selected'}</span>
              </div>
              <div className="kb-pods-search">
                <span className="kb-search-icon">⌕</span>
                <input
                  className="kb-search-input"
                  placeholder="Search by name or namespace…"
                  value={podsSearch}
                  onChange={e => setPodsSearch(e.target.value)}
                />
              </div>
              <button className="kb-modal-close" onClick={() => setPodsListModalOpen(false)}>×</button>
            </div>
            <div className="kb-modal-body custom-scrollbar" style={{ padding: 0 }}>
              {allPods.length === 0 ? (
                <div className="kb-empty tall">Loading pods…</div>
              ) : (() => {
                const filtered = allPods.filter(p => p.name.toLowerCase().includes(podsSearch.toLowerCase()) || p.namespace.toLowerCase().includes(podsSearch.toLowerCase()));
                if (filtered.length === 0) return <div className="kb-empty tall">No pods match “{podsSearch}”.</div>;
                return (
                <table className="kb-table kb-pods-table">
                  <thead>
                    <tr>
                      <th>Namespace</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th className="num">Restarts</th>
                      <th className="num">CPU</th>
                      <th className="num">Mem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const healthy = p.status === 'Running' || p.status === 'Succeeded';
                      return (
                      <tr key={`${p.namespace}/${p.name}`}>
                        <td><span className="kb-pods-ns">{p.namespace}</span></td>
                        <td><span className="kb-pods-name" title={p.name}>{p.name}</span></td>
                        <td><span className={`kb-status ${healthy ? 'ok' : 'crit'}`} style={{ textTransform: 'uppercase' }}>{p.status}</span></td>
                        <td className="num"><span className="kb-pods-num" style={{ color: p.restarts > 0 ? '#f5b544' : 'var(--t2)', fontWeight: p.restarts > 0 ? 600 : 400 }}>{p.restarts}</span></td>
                        <td className="num"><span className="kb-pods-num">{p.cpu}</span></td>
                        <td className="num"><span className="kb-pods-num">{p.memory}</span></td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Troubleshoot Modal */}
      {troubleshootModalOpen && currentInvestigation && (
        <div className="kb-modal-backdrop" onClick={() => setTroubleshootModalOpen(false)}>
          <div className="kb-modal" onClick={e => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw' }}>
            <div className="kb-modal-header">
              <h2 className="kb-modal-title">Manual Investigation</h2>
              <button className="kb-modal-close" onClick={() => setTroubleshootModalOpen(false)}>×</button>
            </div>
            <div className="kb-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: 'var(--t2)', fontSize: '0.9rem', margin: 0 }}>
                Run these commands in your terminal to manually investigate the issue on <strong>{selectedCluster}</strong>.
              </p>
              {(() => {
                let namespace = 'default';
                let podName = '';

                if (currentInvestigation.evidence_used) {
                  for (const ev of currentInvestigation.evidence_used) {
                    if (typeof ev === 'string' && ev.startsWith('logs.')) {
                      const parts = ev.substring(5).split('/');
                      if (parts.length === 2) {
                        namespace = parts[0];
                        podName = parts[1];
                        break;
                      }
                    }
                  }
                }

                const cmds = podName
                  ? [
                    `kubectl --context ${selectedCluster} -n ${namespace} logs ${podName}`,
                    `kubectl --context ${selectedCluster} -n ${namespace} describe pod ${podName}`
                  ]
                  : [
                    `kubectl --context ${selectedCluster} get events --sort-by='.metadata.creationTimestamp'`,
                    `kubectl --context ${selectedCluster} get pods -A | grep -iE 'error|crash|evicted'`
                  ];

                return cmds.map((cmd, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1, padding: '12px', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '6px', fontSize: '12px', color: 'var(--green)', fontFamily: 'var(--font-jetbrains-mono), monospace', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                      $ {cmd}
                    </code>
                    <button
                      className="kb-icon-btn"
                      style={{ flexShrink: 0, borderRadius: '6px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(cmd);
                      }}
                      title="Copy to clipboard"
                    >
                      ⎘
                    </button>
                  </div>
                ));
              })()}
            </div>
            <div className="kb-modal-footer">
              <button className="kb-btn" style={{ width: '100%' }} onClick={() => setTroubleshootModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNavigate={(screen) => navigateTo(screen)}
        clusters={clusters}
      />
    </>
  );
}

/* lightweight illustrative SVG line chart (no dependency) */
function ActivityChart() {
  const W = 420, H = 190, PAD_L = 44, PAD_T = 10, PAD_B = 30;
  const plotW = W - PAD_L, plotH = H - PAD_T - PAD_B;

  const METRICS = [
    { name: 'CPU usage', unit: '%', color: '#7cffb2', key: 'cpu_pct' as const },
    { name: 'Memory usage', unit: '%', color: 'rgba(124,255,178,0.55)', key: 'memory_pct' as const },
    { name: 'Pod count', unit: ' pods', color: 'rgba(255,255,255,0.36)', key: 'pod_count' as const },
  ];

  const [samples, setSamples] = useState<MetricSample[]>([]);
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const [mode, setMode] = useState<'line' | 'bar'>('line');
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

  const getVals = (key: 'cpu_pct' | 'memory_pct' | 'pod_count') => samples.map(s => Math.max(0, s[key] ?? 0));
  const allVals = METRICS.flatMap(m => getVals(m.key));
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
      <div className="kb-legend" style={{ display: 'flex', alignItems: 'center' }}>
        {mode === 'line'
          ? METRICS.map(m => (
            <span key={m.name} className="kb-legend-item">
              <span className="kb-legend-dot" style={{ background: m.color }} />
              {m.name}
            </span>
          ))
          : (
            <span className="kb-legend-item">
              <span className="kb-legend-dot" style={{ background: '#7cffb2' }} />
              CPU usage
            </span>
          )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {(['line', 'bar'] as const).map(mm => (
            <button
              key={mm}
              onClick={() => setMode(mm)}
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '3px 9px', cursor: 'pointer',
                border: '0.5px solid var(--bd)',
                background: mode === mm ? 'var(--green-dim)' : 'transparent',
                color: mode === mm ? 'var(--green)' : 'var(--t3)',
              }}
            >
              {mm === 'line' ? 'Line' : 'Bars'}
            </button>
          ))}
        </div>
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
        <defs>
          <linearGradient id="kb-bargrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7cffb2" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#7cffb2" stopOpacity="0.06" />
          </linearGradient>
        </defs>
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

        {/* bars (primary metric) */}
        {mode === 'bar' && getVals('cpu_pct').map((v, i) => {
          const barW = Math.max(3, PX * 0.6);
          const x = toX(i) - barW / 2;
          const y = toY(v);
          const bh = Math.max(0, (H - PAD_B) - y);
          const isHover = hover?.idx === i;
          return <rect key={i} x={x} y={y} width={barW} height={bh} fill="url(#kb-bargrad)" opacity={isHover ? 1 : 0.9} />;
        })}

        {/* lines */}
        {mode === 'line' && METRICS.map((m, mi) => {
          const vals = getVals(m.key);
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
            {mode === 'line' && METRICS.map((m, mi) => {
              const vals = getVals(m.key);
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
          {(mode === 'line' ? METRICS : [METRICS[0]]).map((m, mi) => (
            <div key={mi} className="kb-tooltip-row">
              <span className="kb-tooltip-dot" style={{ background: m.color }} />
              <span className="kb-tooltip-label">{m.name}</span>
              <span className="kb-tooltip-val">{Math.round(getVals(m.key)[hover.idx] ?? 0)}{m.unit}</span>
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
    <style dangerouslySetInnerHTML={{
      __html: `
      .kb {
        --bg:#060B08; --s1:#0B130D; --s2:#0F1A12; --s3:#16241A;
        --bd:rgba(255,255,255,0.07); --bd2:rgba(255,255,255,0.12);
        --green:#7cffb2; --green-dim:rgba(124,255,178,0.10); --green-bd:rgba(124,255,178,0.28);
        --crit:#ff6b6b; --crit-dim:rgba(255,107,107,0.10); --crit-bd:rgba(255,107,107,0.28);
        --t1:rgba(255,255,255,0.92); --t2:rgba(255,255,255,0.50); --t3:rgba(255,255,255,0.30);
        background:var(--bg); color:var(--t1);
        font-family:var(--font-inter), system-ui, -apple-system, sans-serif;
      }
      .kb .custom-scrollbar, .kb-scroll { scrollbar-width:thin; scrollbar-color:#2f9e62 var(--s1); }
      .kb .custom-scrollbar::-webkit-scrollbar, .kb-scroll::-webkit-scrollbar { width:7px; height:7px; background:var(--s1); }
      .kb .custom-scrollbar::-webkit-scrollbar-track, .kb-scroll::-webkit-scrollbar-track { background:var(--s1); border-left:1px solid var(--green-dim); }
      .kb .custom-scrollbar::-webkit-scrollbar-thumb, .kb-scroll::-webkit-scrollbar-thumb { background:#2f9e62; border:1px solid var(--s1); background-clip:padding-box; }
      .kb .custom-scrollbar::-webkit-scrollbar-thumb:hover, .kb-scroll::-webkit-scrollbar-thumb:hover { background:var(--green); }
      .kb .custom-scrollbar::-webkit-scrollbar-button, .kb-scroll::-webkit-scrollbar-button { display:none; width:0; height:0; }

      .kb-spinner { width:22px; height:22px; border:2px solid var(--green-bd); border-top-color:var(--green); border-radius:50% !important; animation:kb-spin .8s linear infinite; }
      .kb-spinner.sm { width:13px; height:13px; } .kb-spinner.xs { width:12px; height:12px; display:inline-block; }
      @keyframes kb-spin { to { transform:rotate(360deg); } }
      @keyframes kb-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
      .kb .pulse { animation:kb-pulse 2s ease-in-out infinite; }

      /* shell */
      .kb-shell { display:grid; grid-template-columns:236px 1fr; height:100vh; overflow:hidden; }

      /* sidebar */
      .kb-side { display:flex; flex-direction:column; background:var(--s1); border-right:0.5px solid var(--bd); overflow:hidden; }
      .kb-side-logo { display:flex; align-items:center; gap:4px; padding:18px 18px 14px; }
      .kb-side-logo-img { height:36px; width:auto; }
      .kb-side-logo-name { font-family:"Fredoka", system-ui, sans-serif; font-size:18px; font-weight:600; letter-spacing:0.08em; color:#f4f7f9; }
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
      .kb-cluster-switch { position:relative; }
      .kb-cluster-pill { display:inline-flex; align-items:center; gap:7px; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); background:var(--s2); border:0.5px solid var(--bd); padding:5px 11px; cursor:pointer; transition:border-color .15s ease, color .15s ease; }
      .kb-cluster-pill:hover { border-color:var(--green-bd); color:var(--t1); }
      .kb-cluster-caret { color:var(--t3); font-size:9px; margin-left:2px; }
      .kb-cluster-menu { position:absolute; top:calc(100% + 6px); right:0; min-width:180px; background:var(--s1); border:0.5px solid var(--bd2); box-shadow:0 12px 32px -8px rgba(0,0,0,0.7); z-index:50; padding:4px; }
      .kb-cluster-menu-empty { padding:10px 12px; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t3); }
      .kb-cluster-menu-item { width:100%; display:flex; align-items:center; gap:8px; padding:8px 10px; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); background:transparent; border:none; cursor:pointer; text-align:left; }
      .kb-cluster-menu-item:hover { background:var(--s3); color:var(--t1); }
      .kb-cluster-menu-item.active { color:var(--green); background:var(--green-dim); }
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
      .kb-statcard-clickable { cursor: pointer; transition: all 0.2s ease; }
      .kb-statcard-clickable:hover { border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.02); box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }

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

      /* modals */
      @keyframes kb-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kb-modal-slide-up { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      
      .kb-modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: kb-modal-fade-in 0.2s ease-out forwards; }
      .kb-modal { background: var(--bg); border: 0.5px solid var(--bd); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6); overflow: hidden; display: flex; flex-direction: column; width: 850px; max-width: 90vw; max-height: 85vh; border-radius: 8px; animation: kb-modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .kb-modal-header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 0.5px solid var(--bd); background: var(--s1); gap: 16px; }
      .kb-modal-title { font-size: 15px; font-weight: 500; color: var(--t1); margin: 0; white-space: nowrap; }
      .kb-modal-close { background: transparent; border: none; color: var(--t3); font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; line-height: 1; transition: color 0.15s ease; padding: 0; margin-right: -8px; }
      .kb-modal-close:hover { color: var(--t1); }
      .kb-modal-body { flex: 1 1 auto; padding: 20px; overflow-y: auto; position: relative; }
      .kb-modal-footer { flex: 0 0 auto; display: flex; align-items: center; justify-content: flex-end; padding: 16px 20px; border-top: 0.5px solid var(--bd); background: var(--s1); gap: 12px; }

      /* ---------- all pods modal ---------- */
      .kb-pods-backdrop { background:rgba(2, 8, 4, 0.88); backdrop-filter:none; -webkit-backdrop-filter:none; }
      .kb-pods-modal { width:940px; max-width:calc(100vw - 40px); max-height:82vh; background:#0B130D; border:1px solid rgba(124,255,178,0.24); border-radius:0; box-shadow:none; position:relative; }
      .kb-pods-accent { height:3px; width:100%; flex:0 0 auto; background:var(--green); }
      .kb-pods-header { min-height:88px; padding:16px 20px; background:#0d1710; border-bottom:1px solid rgba(124,255,178,0.12); gap:16px; }
      .kb-pods-heading { min-width:190px; display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
      .kb-pods-eyebrow { font-family:var(--font-jetbrains-mono), monospace; font-size:8px; font-weight:600; color:var(--green); letter-spacing:.14em; text-transform:uppercase; }
      .kb-pods-titlewrap { display:flex; align-items:center; gap:9px; }
      .kb-pods-titlewrap .kb-modal-title { font-size:18px; line-height:1.15; font-weight:600; letter-spacing:-.02em; }
      .kb-pods-count { min-width:25px; text-align:center; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; font-weight:700; color:#071009; background:var(--green); border:1px solid var(--green); padding:2px 6px; line-height:1.3; }
      .kb-pods-cluster { max-width:210px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-pods-search { flex:1; max-width:340px; height:38px; margin-left:auto; display:flex; align-items:center; gap:8px; background:#0b130d; border:1px solid rgba(255,255,255,0.10); padding:0 12px; transition:border-color .16s ease, background .16s ease; }
      .kb-pods-search:hover { border-color:rgba(124,255,178,0.22); }
      .kb-pods-search:focus-within { background:#0d1710; border-color:rgba(124,255,178,0.5); }
      .kb-pods-search .kb-search-icon { font-size:13px; color:var(--t3); }
      .kb-pods-search:focus-within .kb-search-icon { color:var(--green); }
      /* input must be seamless inside the search shell — no inner border/background */
      .kb-pods-search .kb-search-input, .kb-search .kb-search-input { flex:1; min-height:0; height:auto; padding:0; background:transparent; border:none; outline:none; color:var(--t1); box-shadow:none; }
      .kb-pods-header .kb-modal-close { flex:0 0 auto; width:38px; height:38px; margin:0; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.10); color:var(--t2); background:#0b130d; font-size:17px; line-height:1; transition:color .18s ease, border-color .18s ease, background .18s ease, transform .18s cubic-bezier(.2,.8,.2,1); }
      .kb-pods-header .kb-modal-close:hover { color:var(--green); border-color:rgba(124,255,178,0.45); background:#102016; }
      .kb-pods-modal .kb-modal-body { background:#0B130D; scrollbar-width:thin; scrollbar-color:#2f9e62 #0b130d; }
      .kb-pods-modal .kb-modal-body::-webkit-scrollbar { width:8px; background:#0b130d; }
      .kb-pods-modal .kb-modal-body::-webkit-scrollbar-track { background:#0b130d; }
      .kb-pods-modal .kb-modal-body::-webkit-scrollbar-thumb { background:#2f9e62; border:1px solid #0b130d; }
      .kb-pods-modal .kb-modal-body::-webkit-scrollbar-thumb:hover { background:#7cffb2; }
      .kb-pods-modal .kb-modal-body::-webkit-scrollbar-button { display:none; width:0; height:0; }
      .kb-pods-table { table-layout:auto; background:#0B130D; }
      .kb-pods-table th, .kb-pods-table td { padding:13px 20px; }
      .kb-pods-table thead th { position:sticky; top:0; z-index:1; background:#102016; color:rgba(124,255,178,0.68); border-bottom:1px solid rgba(124,255,178,0.18); font-size:9px; font-weight:600; letter-spacing:.1em; }
      .kb-pods-table th.num, .kb-pods-table td.num { text-align:right; }
      .kb-pods-table tbody tr { cursor:default; background:#0B130D; transition:background .12s ease; }
      .kb-pods-table tbody tr:hover { background:#102016; }
      .kb-pods-table tbody td { border-bottom:1px solid rgba(124,255,178,0.08); }
      .kb-pods-ns { display:inline-block; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:rgba(244,247,249,.58); background:#111F15; border:1px solid rgba(124,255,178,0.10); padding:3px 8px; }
      .kb-pods-name { display:inline-block; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t1); vertical-align:middle; }
      .kb-pods-num { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); }
      .kb-pods-modal .kb-status.ok { color:var(--green); background:rgba(124,255,178,.08); border-color:rgba(124,255,178,.32); }
      .kb-pods-modal .kb-status.crit { color:var(--crit); background:var(--crit-dim); border-color:var(--crit-bd); }
      .kb-pods-modal .kb-empty { color:var(--t2); background:#0B130D; }
      @media (max-width:720px) {
        .kb-pods-modal { max-width:calc(100vw - 20px); }
        .kb-pods-header { align-items:flex-start; flex-wrap:wrap; }
        .kb-pods-heading { min-width:0; flex:1; }
        .kb-pods-search { order:3; width:100%; max-width:none; margin:0; flex-basis:100%; }
        .kb-pods-table th, .kb-pods-table td { padding:11px 14px; }
      }

      /* ---------- incidents v2 - readable cards ---------- */
      .kb-live-tag { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--green); margin-right:10px; }
      .kb-live-dot { width:6px; height:6px; background:var(--green); box-shadow:0 0 6px var(--green); animation:kb-pulse 1.5s ease-in-out infinite; }
      .kb-inc-ns { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; color:var(--t3); background:var(--s3); padding:1px 6px; margin-left:8px; }
      .kb-inc-count { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--crit); align-self:center; white-space:nowrap; }
      .kb-inline-code { display:inline-block; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t1); margin-top:3px; }
      .kb-incx-wrap { border-bottom:0.5px solid var(--bd); }
      .kb-incx { display:grid; grid-template-columns:40px 1fr auto; gap:14px; align-items:flex-start; padding:16px 18px; cursor:pointer; transition:background .12s ease; border-left:2px solid transparent; }
      .kb-incx:hover { background:var(--s2); }
      .kb-incx.critical { border-left-color:var(--crit); }
      .kb-incx.warning { border-left-color:#f5b544; }
      .kb-incx-icon { width:34px; height:34px; display:flex; align-items:center; justify-content:center; font-family:var(--font-jetbrains-mono), monospace; font-size:15px; font-weight:600; flex-shrink:0; }
      .kb-incx-icon.critical { color:var(--crit); background:var(--crit-dim); border:0.5px solid var(--crit-bd); }
      .kb-incx-icon.warning { color:#f5b544; background:rgba(245,181,68,0.1); border:0.5px solid rgba(245,181,68,0.3); }
      .kb-incx-body { min-width:0; }
      .kb-incx-title { font-size:14px; font-weight:600; color:var(--t1); letter-spacing:-0.01em; }
      .kb-incx-why { font-size:12.5px; color:var(--t2); line-height:1.5; margin-top:3px; }
      .kb-incx-loc { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
      .kb-loc-chip { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-jetbrains-mono), monospace; font-size:10.5px; color:var(--t1); background:var(--s1); border:0.5px solid var(--bd); padding:3px 8px; }
      .kb-loc-chip .k { color:var(--t3); text-transform:uppercase; letter-spacing:0.05em; font-size:9px; }
      .kb-incx-right { display:flex; flex-direction:column; align-items:flex-end; gap:8px; white-space:nowrap; }
      .kb-crash-badge { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; padding:3px 9px; letter-spacing:0.03em; }
      .kb-crash-badge.critical { color:var(--crit); background:var(--crit-dim); border:0.5px solid var(--crit-bd); }
      .kb-crash-badge.warning { color:#f5b544; background:rgba(245,181,68,0.1); border:0.5px solid rgba(245,181,68,0.3); }
      .kb-incx-meta { display:inline-flex; align-items:center; gap:10px; }
      .kb-incx-cnt { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--crit); }
      .kb-incx-time { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-incx-detail { padding:18px 18px 22px 22px; background:var(--s2); display:flex; flex-direction:column; gap:16px; border-left:2px solid var(--bd2); }
      .kb-incx-loctable { display:grid; grid-template-columns:repeat(4, 1fr); gap:1px; background:var(--bd); border:0.5px solid var(--bd); }
      .kb-incx-loctable > div { background:var(--s1); padding:11px 13px; display:flex; flex-direction:column; gap:5px; }
      .kb-incx-loctable .k { font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:var(--t3); }
      .kb-incx-loctable code { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); word-break:break-all; }
      .kb-incx-sec { display:flex; flex-direction:column; gap:5px; }
      .kb-explanation.mono { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); background:rgba(0,0,0,0.3); border:0.5px solid var(--bd); padding:9px 11px; }

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

      /* ================================================================
         2026 PROFESSIONAL SAAS REDESIGN LAYER
         ================================================================ */
      .kb, .kb-modal-backdrop, .kb-cmdk-overlay, .kb-drawer, .kb-drawer-backdrop {
        --bg:#060B08; --s1:#0B130D; --s2:#0F1A12; --s3:#16241A;
        --bd:rgba(255,255,255,0.07); --bd2:rgba(255,255,255,0.12);
        --green:#7cffb2; --green-dim:rgba(124,255,178,0.10); --green-bd:rgba(124,255,178,0.28);
        --crit:#ff6b6b; --crit-dim:rgba(255,107,107,0.10); --crit-bd:rgba(255,107,107,0.28);
        --t1:rgba(255,255,255,0.92); --t2:rgba(255,255,255,0.50); --t3:rgba(255,255,255,0.30);
      }
      .kb, .kb * { box-sizing:border-box; }
      .kb { min-height:100vh; background:#060b08; color:var(--t1); }
      .kb button, .kb input, .kb textarea, .kb select { font:inherit; }
      .kb button:focus-visible, .kb input:focus-visible, .kb textarea:focus-visible, .kb select:focus-visible,
      .kb [tabindex]:focus-visible { outline:2px solid var(--green); outline-offset:2px; }

      .kb-shell { grid-template-columns:252px minmax(0,1fr); background:#060b08; }
      .kb-side { background:#09110b; border-right:1px solid rgba(124,255,178,.10); }
      .kb-side-logo { min-height:66px; padding:14px 18px; gap:7px; border-bottom:1px solid rgba(124,255,178,.08); }
      .kb-side-logo-img { height:34px; }
      .kb-side-logo-name { font-size:17px; }
      .kb-side-plan { margin-left:auto; padding:3px 6px; border:1px solid rgba(124,255,178,.16); color:var(--t3); font-family:var(--font-jetbrains-mono),monospace; font-size:8px; letter-spacing:.08em; text-transform:uppercase; }
      .kb-nav { padding:12px 8px; gap:3px; }
      .kb-nav-section { padding:0; margin-bottom:13px; }
      .kb-nav-label { padding:8px 10px 7px; color:rgba(255,255,255,.27); font-weight:600; }
      .kb-nav-item { position:relative; min-height:38px; padding:9px 10px; gap:10px; border:1px solid transparent; color:rgba(255,255,255,.55); font-weight:450; transition:background .16s ease,color .16s ease,border-color .16s ease,transform .16s ease; }
      .kb-nav-item::before { content:""; position:absolute; left:-1px; top:8px; bottom:8px; width:2px; background:transparent; }
      .kb-nav-item:hover { background:#102016; border-color:rgba(124,255,178,.08); color:var(--t1); transform:translateX(1px); }
      .kb-nav-item.active { background:#102016; border-color:rgba(124,255,178,.14); color:var(--green); }
      .kb-nav-item.active::before { background:var(--green); }
      .kb-nav-icon { width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; color:inherit; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.05); }
      .kb-nav-item.active .kb-nav-icon { background:var(--green-dim); border-color:var(--green-bd); }
      .kb-profile { min-height:64px; background:#0b150e; border-top:1px solid rgba(124,255,178,.09); }
      .kb-profile-out { width:30px; height:30px; border:1px solid transparent; }
      .kb-profile-out:hover { background:var(--crit-dim); border-color:var(--crit-bd); }

      .kb-maincol { min-width:0; background:#060b08; }
      .kb-topbar { height:66px; padding:0 24px; gap:18px; background:#09110b; border-bottom:1px solid rgba(124,255,178,.09); }
      .kb-mobile-menu { display:none; width:34px; height:34px; padding:0; background:#0f1a12; border:1px solid var(--bd); color:var(--t2); cursor:pointer; }
      .kb-topbar-context { width:116px; display:flex; flex-direction:column; gap:2px; flex-shrink:0; }
      .kb-topbar-context span { font-family:var(--font-jetbrains-mono),monospace; color:var(--t3); font-size:8px; letter-spacing:.12em; text-transform:uppercase; }
      .kb-topbar-context strong { color:var(--t1); font-size:12px; font-weight:600; }
      .kb-search { min-width:220px; max-width:500px; height:36px; padding:0 12px; background:#0d1710; border:1px solid rgba(255,255,255,.08); color:var(--t2); cursor:pointer; text-align:left; transition:border-color .16s ease,background .16s ease; }
      .kb-search:hover { background:#102016; border-color:rgba(124,255,178,.22); }
      .kb-search-copy { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--t3); }
      .kb-kbd { border:1px solid rgba(255,255,255,.07); background:#16241a; }
      .kb-icon-btn { width:34px; height:34px; background:#0d1710; border:1px solid rgba(255,255,255,.09); transition:all .16s ease; }
      .kb-icon-btn:hover { background:#14251a; border-color:var(--green-bd); color:var(--green); }
      .kb-cluster-pill { min-height:34px; padding:7px 11px; background:#0d1710; border:1px solid rgba(124,255,178,.14); color:var(--t1); }
      .kb-cluster-menu { top:calc(100% + 8px); min-width:220px; padding:6px; background:#0b130d; border:1px solid rgba(124,255,178,.18); box-shadow:0 18px 50px rgba(0,0,0,.45); animation:kb-menu-in .16s ease both; }
      @keyframes kb-menu-in { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }

      .kb-scroll { background:#060b08; scroll-behavior:smooth; }
      .kb-screen { width:100%; max-width:1440px; margin:0 auto; padding:30px 34px 64px; gap:20px; animation:kb-screen-in .32s cubic-bezier(.2,.8,.2,1) both; }
      @keyframes kb-screen-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      .kb-screen > * { animation:kb-block-in .36s cubic-bezier(.2,.8,.2,1) both; }
      .kb-screen > *:nth-child(2){animation-delay:.035s}.kb-screen > *:nth-child(3){animation-delay:.07s}.kb-screen > *:nth-child(4){animation-delay:.105s}
      @keyframes kb-block-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      .kb-welcome { min-height:70px; align-items:center; padding-bottom:18px; border-bottom:1px solid rgba(124,255,178,.09); }
      .kb-welcome-title { font-size:25px; line-height:1.2; font-weight:550; letter-spacing:-.025em; }
      .kb-welcome-sub { margin:7px 0 0; color:rgba(255,255,255,.40); line-height:1.5; }
      .kb-welcome-actions { align-items:center; flex-wrap:wrap; }
      .kb-agent-status { display:inline-flex!important; align-items:center!important; gap:8px!important; padding:8px 11px!important; background:var(--green-dim)!important; border:1px solid var(--green-bd)!important; color:var(--green)!important; border-radius:0!important; font-family:var(--font-jetbrains-mono),monospace!important; font-size:10px!important; font-weight:600!important; }
      .kb-agent-status .kb-dot { background:var(--green)!important; }

      .kb-btn { min-height:34px; padding:8px 14px; background:#0d1710; border:1px solid rgba(255,255,255,.11); color:var(--t2); font-weight:500; transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease; }
      .kb-btn:hover:not(:disabled) { background:#14251a; border-color:rgba(124,255,178,.28); color:var(--t1); transform:translateY(-1px); }
      .kb-btn.primary { background:var(--green); border-color:var(--green); color:#061009; font-weight:650; }
      .kb-btn.primary:hover:not(:disabled) { background:#a0ffc7; border-color:#a0ffc7; color:#061009; }
      .kb-btn:active:not(:disabled) { transform:translateY(0); }

      .kb-card, .kb-statcard { background:#0b130d; border:1px solid rgba(255,255,255,.075); box-shadow:0 1px 0 rgba(255,255,255,.015); }
      .kb-card { transition:border-color .18s ease,background .18s ease,transform .18s ease; }
      .kb-card:hover { border-color:rgba(124,255,178,.14); }
      .kb-col-header { min-height:47px; padding:13px 17px; background:#0d1710; border-bottom:1px solid rgba(255,255,255,.07); }
      .kb-col-title { color:rgba(255,255,255,.58); font-weight:650; }
      .kb-count { color:var(--green); background:var(--green-dim); border:1px solid rgba(124,255,178,.12); }

      .kb-stat-row { gap:12px; }
      .kb-statcard { position:relative; min-width:0; padding:17px; color:inherit; text-align:left; overflow:hidden; transition:border-color .18s ease,background .18s ease,transform .18s ease; }
      button.kb-statcard { appearance:none; width:100%; cursor:pointer; }
      .kb-statcard::after { content:""; position:absolute; left:0; top:0; width:2px; height:100%; background:rgba(124,255,178,.28); transform:scaleY(0); transform-origin:bottom; transition:transform .22s ease; }
      .kb-statcard:hover { background:#0e1911; border-color:rgba(124,255,178,.22); transform:translateY(-2px); }
      .kb-statcard:hover::after { transform:scaleY(1); }
      .kb-statcard-top { margin-bottom:18px; }
      .kb-statcard-icon { width:25px; height:25px; display:inline-flex; align-items:center; justify-content:center; background:var(--green-dim); border:1px solid rgba(124,255,178,.14); }
      .kb-statcard-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
      .kb-statcard-val { font-size:31px; font-weight:600; letter-spacing:-.04em; }
      .kb-statcard-foot { border-top-color:rgba(255,255,255,.06); }
      .kb-statcard-clickable:hover { box-shadow:none; }

      .kb-grid-2 { gap:12px; grid-template-columns:minmax(0,1.65fr) minmax(300px,1fr); }
      .kb-chart-wrap { padding:18px; }
      .kb-anomaly { background:#0d1710; border-color:rgba(124,255,178,.09); }
      .kb-seg { height:8px; background:#18261b; }
      .kb-seg.on { box-shadow:none; }
      .kb-seg.on.warn { background:#f5b544; }
      .kb-seg.on.crit { background:var(--crit); }

      .kb-table-wrap { scrollbar-width:thin; }
      .kb-table th { position:sticky; top:0; z-index:1; padding:12px 17px; background:#0d1710; color:rgba(255,255,255,.36); border-bottom:1px solid rgba(124,255,178,.09); font-weight:650; }
      .kb-table td { padding:14px 17px; border-bottom:1px solid rgba(255,255,255,.055); }
      .kb-table tbody tr { transition:background .14s ease; }
      .kb-table tbody tr:hover { background:#102016; }
      .kb-table tbody tr:last-child td { border-bottom:0; }
      .kb-status, .kb-tag, .kb-risk-badge, .kb-crash-badge { font-weight:650; letter-spacing:.04em; }
      .kb-search-input, .kb-workload-search { min-height:34px; background:#0d1710; border:1px solid rgba(255,255,255,.09); padding:7px 10px; }
      select.kb-search-input { color:var(--t2); cursor:pointer; }

      .kb-cluster-grid { gap:10px; padding:14px; }
      .kb-cluster-card { position:relative; background:#0d1710; border:1px solid rgba(255,255,255,.075); padding:16px; }
      .kb-cluster-card:hover { background:#122019; border-color:rgba(124,255,178,.22); transform:translateY(-1px); }
      .kb-cluster-card.selected { background:#102016; border-color:rgba(124,255,178,.42); box-shadow:inset 3px 0 0 var(--green); }
      .kb-progress { gap:0; padding:18px; }
      .kb-step { min-height:40px; position:relative; }
      .kb-step:not(:last-child)::after { content:""; position:absolute; left:10px; top:30px; width:1px; height:20px; background:var(--bd2); }
      .kb-step.completed:not(:last-child)::after { background:var(--green-bd); }
      .kb-step-icon { background:#0d1710; }
      .kb-nested, .kb-code { background:#071009; border-color:rgba(124,255,178,.10); }

      .kb-empty { min-height:100px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.34); line-height:1.6; }
      .kb-error { border-left:3px solid var(--crit); }
      .kb-filter-pill { min-height:28px; padding:4px 11px; }
      .kb-filter-pill:hover { color:var(--t1); background:#14251a; }
      .kb-filter-pill.active { background:var(--green); border-color:var(--green); color:#061009; font-weight:700; }

      .kb-incx-wrap { background:#0b130d; border-bottom-color:rgba(255,255,255,.06); }
      .kb-incx { padding:18px; transition:background .16s ease,transform .16s ease; }
      .kb-incx:hover { background:#0f1c13; }
      .kb-incx-detail { background:#08110b; animation:kb-detail-in .2s ease both; }
      @keyframes kb-detail-in { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
      .kb-loc-chip { background:#0d1710; }

      .kb-table-head-row { min-height:42px; align-items:center; background:#0d1710; border-bottom-color:rgba(124,255,178,.09); font-weight:650; }
      .kb-wl-row { min-height:54px; border-bottom-color:rgba(255,255,255,.055); }
      .kb-wl-row:hover { background:#102016; }
      .kb-drawer-backdrop, .kb-modal-backdrop, .kb-cmdk-overlay { background:rgba(2,8,4,.88); backdrop-filter:none; -webkit-backdrop-filter:none; }
      .kb-drawer-backdrop { padding:0; border:0; cursor:default; }
      .kb-drawer { width:min(420px,100vw); background:#0b130d; border-left:1px solid rgba(124,255,178,.18); box-shadow:-20px 0 60px rgba(0,0,0,.38); }
      .kb-drawer-head { min-height:70px; background:#0d1710; border-bottom-color:rgba(124,255,178,.10); }
      .kb-drawer-row { min-height:45px; border-bottom-color:rgba(255,255,255,.06); }

      .kb-node-grid, .kb-playbook-grid { gap:12px; }
      .kb-node-card, .kb-playbook-card { background:#0b130d; }
      .kb-node-card:hover, .kb-playbook-card:hover { background:#0e1911; border-color:rgba(124,255,178,.22); transform:translateY(-2px); }
      .kb-playbook-card { cursor:default; }
      .kb-playbook-desc { min-height:56px; }

      .kb-pr-note { background:#0d1710; border-color:rgba(124,255,178,.12); border-left:2px solid var(--green); }
      .kb-pr-card { border-color:rgba(255,255,255,.075); }
      .kb-pr-card.safe { opacity:1; }
      .kb-pr-card.medium, .kb-risk-badge.medium, .kb-pr-status.medium { border-color:rgba(245,181,68,.3); }
      .kb-risk-badge.medium, .kb-pr-status.medium { color:#f5b544; background:rgba(245,181,68,.10); }
      .kb-pr-number { color:var(--green); }
      .kb-pr-head, .kb-pr-meta, .kb-pr-body { border-bottom-color:rgba(255,255,255,.06); }

      .kb-settings-grid { grid-template-columns:210px minmax(0,1fr); gap:16px; }
      .kb-settings-nav { padding:8px; background:#0b130d; border:1px solid rgba(255,255,255,.075); position:sticky; top:0; }
      .kb-settings-nav .kb-nav-item.active { background:#102016; }
      .kb-trust-card { background:#0d1710; border:1px solid rgba(255,255,255,.075); transition:all .16s ease; }
      .kb-trust-card:hover { border-color:rgba(124,255,178,.20); }
      .kb-trust-card.selected { background:#102016; border-color:var(--green-bd); }

      .kb-ask-screen { background:#060b08; }
      .kb-ask-chat { max-width:800px; padding:34px 28px; }
      .kb-chat-row.user { flex-direction:row-reverse; }
      .kb-chat-row.kubric { flex-direction:row; }
      .kb-chat-bubble { max-width:590px; padding:12px 15px; background:#0d1710; border-color:rgba(255,255,255,.08); }
      .kb-chat-bubble.user { background:#122019; border-color:rgba(124,255,178,.15); }
      .kb-chat-bubble.kubric { border-left:2px solid var(--green); }
      .kb-ask-input-wrap { background:#09110b; border-top-color:rgba(124,255,178,.09); }
      .kb-ask-input-inner { max-width:800px; background:#0d1710; border:1px solid rgba(124,255,178,.14); }
      .kb-ask-chip { background:#0d1710; }

      .kb-modal { background:#0b130d; border:1px solid rgba(124,255,178,.18); border-radius:0; box-shadow:0 22px 70px rgba(0,0,0,.48); }
      .kb-modal-header, .kb-modal-footer { background:#0d1710; border-color:rgba(124,255,178,.10); }
      .kb-cmdk { background:#0b130d; border:1px solid rgba(124,255,178,.20); box-shadow:0 22px 70px rgba(0,0,0,.48); animation:kb-menu-in .18s ease both; }
      .kb-cmdk-item { border-left:2px solid transparent; }
      .kb-cmdk-item:hover, .kb-cmdk-item.selected { background:#102016; border-left-color:var(--green); }

      .kb-side-backdrop { display:none; }
      @media (max-width:1100px) and (min-width:761px) {
        .kb-shell { grid-template-columns:72px minmax(0,1fr); }
        .kb-side-logo { justify-content:center; padding-inline:8px; }
        .kb-side-logo-name, .kb-side-plan, .kb-nav-label, .kb-profile-info { display:none; }
        .kb-nav-item { justify-content:center; padding-inline:8px; font-size:0; }
        .kb-nav-icon { margin:0; font-size:13px; }
        .kb-nav-badge { position:absolute; right:1px; top:3px; }
        .kb-profile { justify-content:center; padding-inline:6px; }
        .kb-profile-out { display:none; }
        .kb-screen { padding-inline:24px; }
      }
      @media (max-width:760px) {
        .kb-shell { display:block; }
        .kb-side { position:fixed; z-index:1200; inset:0 auto 0 0; width:270px; transform:translateX(-100%); transition:transform .22s cubic-bezier(.2,.8,.2,1); box-shadow:18px 0 60px rgba(0,0,0,.55); }
        .kb-side.open { transform:translateX(0); }
        .kb-side.open .kb-side-logo-name, .kb-side.open .kb-side-plan, .kb-side.open .kb-nav-label, .kb-side.open .kb-profile-info { display:block; }
        .kb-side.open .kb-nav-item { justify-content:flex-start; font-size:13px; }
        .kb-side-backdrop { display:block; position:fixed; z-index:1190; inset:0; width:100%; height:100%; padding:0; background:rgba(2,8,4,.84); border:0; }
        .kb-mobile-menu { display:inline-flex; align-items:center; justify-content:center; }
        .kb-topbar { height:60px; padding:0 14px; gap:10px; }
        .kb-topbar-context { width:auto; flex:1; }
        .kb-search { min-width:34px; width:34px; flex:0 0 34px; padding:0; justify-content:center; }
        .kb-search-copy, .kb-search .kb-kbd { display:none; }
        .kb-topbar-right { margin:0; gap:7px; }
        .kb-cluster-pill { max-width:150px; overflow:hidden; }
        .kb-screen { padding:22px 15px 48px; gap:15px; }
        .kb-welcome { align-items:flex-start; }
        .kb-welcome-title { font-size:22px; }
        .kb-stat-row { grid-template-columns:1fr 1fr; gap:9px; }
        .kb-statcard { padding:14px; }
        .kb-statcard-val { font-size:26px; }
        .kb-grid-2, .kb-two-col { grid-template-columns:1fr; }
        .kb-settings-grid { grid-template-columns:1fr; }
        .kb-settings-nav { position:static; flex-direction:row; overflow-x:auto; }
        .kb-settings-nav .kb-nav-item { width:auto!important; white-space:nowrap; }
        .kb-incx { grid-template-columns:34px minmax(0,1fr); }
        .kb-incx-right { grid-column:2; align-items:flex-start; flex-direction:row; flex-wrap:wrap; }
        .kb-incx-loctable { grid-template-columns:1fr 1fr; }
        .kb-pr-head, .kb-pr-foot { flex-wrap:wrap; }
        .kb-pr-status { margin-left:auto; }
        .kb-filterbar { width:100%; margin:8px 0 0; }
        .kb-col-header { flex-wrap:wrap; }
      }
      @media (max-width:480px) {
        .kb-stat-row { grid-template-columns:1fr; }
        .kb-icon-btn { display:none; }
        .kb-cluster-pill { max-width:132px; }
        .kb-ask-input-wrap { padding:12px; }
        .kb-ask-hint { display:none; }
        .kb-ask-send span:first-child { display:none; }
      }
      /* ---------- typography + interaction refinement ---------- */
      .kb h1, .kb h2, .kb h3, .kb h4, .kb h5, .kb h6,
      .kb .kb-welcome-title, .kb .kb-modal-title, .kb .kb-ask-empty-title,
      .kb .kb-playbook-title, .kb .kb-healthy-title, .kb .kb-soon-title,
      .kb .kb-drawer-title, .kb .kb-incx-title, .kb .kb-pr-title,
      .kb-modal-backdrop .kb-modal-title, .kb-modal-backdrop .kb-pods-titlewrap .kb-modal-title {
        font-family:var(--font-lexend),system-ui,sans-serif!important;
        font-weight:500;
      }
      .kb .kb-welcome-sub, .kb .kb-statcard-meta, .kb .kb-field-label,
      .kb .kb-node-roles, .kb .kb-node-caps, .kb .kb-playbook-desc,
      .kb .kb-playbook-foot, .kb .kb-trust-desc, .kb .kb-pr-meta,
      .kb .kb-ask-empty-sub, .kb .kb-drawer-sub, .kb .kb-empty,
      .kb-modal-backdrop .kb-pods-eyebrow, .kb-modal-backdrop .kb-pods-cluster,
      .kb-modal-backdrop .kb-pods-count, .kb-modal-backdrop .kb-pods-table,
      .kb-modal-backdrop .kb-pods-search input {
        font-family:var(--font-jetbrains-mono),monospace;
      }

      /* Restore the lighter, original dashboard button language. */
      .kb .kb-btn, .kb .kb-nav-item, .kb .kb-icon-btn, .kb .kb-cluster-pill,
      .kb .kb-filter-pill, .kb .kb-ask-send, .kb .kb-ask-attach,
      .kb .kb-ask-chip, .kb .kb-cmdk-item, .kb-modal-backdrop .kb-modal-close,
      .kb-modal-backdrop .kb-btn {
        font-family:var(--font-inter),system-ui,-apple-system,sans-serif;
        font-weight:500;
        letter-spacing:0;
      }
      .kb .kb-cluster-pill, .kb .kb-cluster-menu-item, .kb .kb-filter-pill,
      .kb .kb-kbd, .kb .kb-topbar-context, .kb .kb-count {
        font-family:var(--font-jetbrains-mono),monospace;
        font-weight:400;
      }
      .kb .kb-btn, .kb-modal-backdrop .kb-btn {
        min-height:34px;
        padding:8px 15px;
        font-size:12px;
        background:transparent;
        color:var(--t2);
        border:1px solid var(--bd2);
        transition:color .16s ease,background-color .16s ease,border-color .16s ease,transform .16s cubic-bezier(.2,.8,.2,1);
      }
      .kb .kb-btn:hover:not(:disabled), .kb-modal-backdrop .kb-btn:hover:not(:disabled) {
        color:var(--t1);
        background:var(--s3);
        border-color:var(--green-bd);
        transform:translateY(-1px);
      }
      .kb .kb-btn.primary, .kb-modal-backdrop .kb-btn.primary {
        min-height:38px;
        padding:9px 18px;
        color:var(--green);
        background:#0b130d;
        border:1px solid rgba(124,255,178,.52);
        font-weight:500;
        box-shadow:inset 0 0 0 1px rgba(124,255,178,.04);
      }
      .kb .kb-btn.primary:hover:not(:disabled), .kb-modal-backdrop .kb-btn.primary:hover:not(:disabled) {
        color:#061009;
        background:var(--green);
        border-color:var(--green);
        box-shadow:none;
      }
      .kb .kb-btn:active:not(:disabled), .kb-modal-backdrop .kb-btn:active:not(:disabled) {
        transform:translateY(0) scale(.985);
        transition-duration:.06s;
      }
      .kb .kb-btn:disabled { opacity:.4; filter:saturate(.5); }

      /* Inputs: one clean focus state instead of nested/double outlines. */
      .kb .kb-search-input, .kb .kb-workload-search, .kb .kb-ask-textarea,
      .kb-modal-backdrop .kb-search-input {
        font-family:var(--font-jetbrains-mono),monospace;
        font-weight:400;
        letter-spacing:-.015em;
      }
      .kb .kb-search-input:focus-visible, .kb .kb-workload-search:focus-visible,
      .kb .kb-ask-textarea:focus-visible, .kb-modal-backdrop .kb-search-input:focus-visible {
        outline:none;
      }
      .kb .kb-workload-search:focus {
        border-color:rgba(124,255,178,.48);
        background:#101e14;
      }
      .kb .kb-ask-input-wrap {
        padding:16px 24px 22px;
        background:#09110b;
        border-top:1px solid rgba(124,255,178,.09);
      }
      .kb .kb-ask-input-inner {
        max-width:820px;
        min-height:56px;
        padding:9px 10px;
        gap:10px;
        background:#0b150e;
        border:1px solid rgba(255,255,255,.10);
        box-shadow:inset 2px 0 0 transparent;
        transition:border-color .18s ease,background-color .18s ease,box-shadow .18s ease,transform .18s ease;
      }
      .kb .kb-ask-input-inner:hover {
        background:#0e1911;
        border-color:rgba(124,255,178,.20);
      }
      .kb .kb-ask-input-inner:focus-within {
        background:#0f1b12;
        border-color:rgba(124,255,178,.55);
        box-shadow:inset 2px 0 0 var(--green);
        transform:translateY(-1px);
      }
      .kb .kb-ask-textarea {
        min-height:30px;
        padding:5px 2px;
        color:var(--t1);
        font-size:12px;
        line-height:1.6;
        caret-color:var(--green);
      }
      .kb .kb-ask-textarea::placeholder { color:rgba(255,255,255,.28); }
      .kb .kb-ask-attach {
        width:36px;
        height:36px;
        color:var(--t3);
        background:#111f15;
        border:1px solid rgba(255,255,255,.08);
        transition:color .16s ease,background-color .16s ease,border-color .16s ease,transform .16s ease;
      }
      .kb .kb-ask-attach:hover:not(:disabled) {
        color:var(--green);
        background:var(--green-dim);
        border-color:var(--green-bd);
        transform:translateY(-1px);
      }
      .kb .kb-ask-send {
        min-height:36px;
        padding:8px 14px;
        color:var(--green);
        background:var(--green-dim);
        border:1px solid var(--green-bd);
        font-size:12px;
        transition:background-color .16s ease,border-color .16s ease,transform .16s ease;
      }
      .kb .kb-ask-send:hover:not(:disabled) {
        background:rgba(124,255,178,.16);
        border-color:rgba(124,255,178,.50);
        transform:translateY(-1px);
      }
      .kb .kb-ask-send:hover:not(:disabled) .kb-ask-send-arrow { transform:translateX(3px); }
      .kb .kb-ask-hint { font-family:var(--font-jetbrains-mono),monospace; opacity:.7; }

      /* Content suggestions remain technical/light while action buttons stay familiar. */
      .kb .kb-ask-empty-title { font-size:19px; letter-spacing:-.02em; }
      .kb .kb-ask-empty-sub { font-size:11px; line-height:1.75; }
      .kb .kb-ask-chip {
        min-height:64px;
        padding:13px 15px;
        font-family:var(--font-jetbrains-mono),monospace;
        font-size:11px;
        font-weight:400;
        line-height:1.55;
        background:#0d1710;
        border:1px solid rgba(255,255,255,.08);
        transition:color .18s ease,background-color .18s ease,border-color .18s ease,transform .18s cubic-bezier(.2,.8,.2,1);
      }
      .kb .kb-ask-chip:hover {
        color:var(--t1);
        background:#102016;
        border-color:rgba(124,255,178,.30);
        transform:translateY(-2px);
      }
      .kb .kb-ask-chip:hover .kb-ask-chip-icon { transform:scale(1.12) rotate(-4deg); }
      .kb .kb-ask-chip-icon { transition:transform .18s ease; }
      .kb .kb-ask-chip-arrow { transition:opacity .18s ease,color .18s ease,transform .18s ease; }

      /* Consistent high-quality micro interactions across the console. */
      .kb .kb-nav-item:hover .kb-nav-icon { transform:translateX(1px) scale(1.04); }
      .kb .kb-nav-icon { transition:transform .16s ease,background-color .16s ease,border-color .16s ease; }
      .kb .kb-cluster-pill[aria-expanded="true"] { color:var(--green); border-color:var(--green-bd); background:var(--green-dim); }
      .kb .kb-cluster-pill[aria-expanded="true"] .kb-cluster-caret { transform:rotate(180deg); }
      .kb .kb-cluster-caret { transition:transform .18s ease,color .18s ease; }
      .kb .kb-icon-btn:hover { transform:translateY(-1px); }
      .kb .kb-icon-btn:active { transform:translateY(0) scale(.96); }
      .kb button.kb-statcard:hover .kb-statcard-dots { color:var(--green); transform:translate(2px,-2px); }
      .kb .kb-statcard-dots { transition:color .18s ease,transform .18s ease; }
      .kb .kb-card, .kb .kb-node-card, .kb .kb-playbook-card,
      .kb .kb-cluster-card, .kb .kb-pr-card {
        transition:border-color .18s ease,background-color .18s ease,transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease;
      }
      .kb .kb-node-card:hover, .kb .kb-playbook-card:hover, .kb .kb-cluster-card:hover {
        box-shadow:0 10px 28px rgba(0,0,0,.18);
      }
      .kb .kb-wl-row { transition:background-color .14s ease,box-shadow .14s ease; }
      .kb .kb-wl-row:hover { box-shadow:inset 2px 0 0 var(--green); }
      .kb .kb-filter-pill { transition:color .14s ease,background-color .14s ease,border-color .14s ease,transform .14s ease; }
      .kb .kb-filter-pill:hover { transform:translateY(-1px); }
      .kb .kb-filter-pill:active { transform:translateY(0) scale(.97); }
      .kb .kb-switch-knob { transition:left .18s cubic-bezier(.2,.8,.2,1),background-color .18s ease,transform .18s ease; }
      .kb .kb-switch:hover .kb-switch-knob { transform:scale(1.08); }
      .kb .kb-incx:hover .kb-inc-chevron { color:var(--green); transform:translateX(2px); }
      .kb .kb-inc-chevron { display:inline-block; transition:color .16s ease,transform .16s ease; }
      .kb .kb-modal-close, .kb-modal-backdrop .kb-modal-close { transition:color .18s ease,background-color .18s ease,border-color .18s ease,transform .18s cubic-bezier(.2,.8,.2,1); }
      .kb .kb-modal-close:hover, .kb-modal-backdrop .kb-modal-close:hover { color:var(--green); transform:scale(1.1); }
      .kb .kb-modal-close:active, .kb-modal-backdrop .kb-modal-close:active { transform:scale(.9); transition-duration:.06s; }

      /* Modal typography is isolated because overlays live outside .kb. */
      .kb-modal-backdrop { font-family:var(--font-inter),system-ui,sans-serif; }
      .kb-modal-backdrop .kb-pods-header { min-height:96px; }
      .kb-modal-backdrop .kb-pods-titlewrap .kb-modal-title { font-size:18px; letter-spacing:-.025em; }
      .kb-modal-backdrop .kb-pods-search {
        height:38px;
        transition:border-color .16s ease,background-color .16s ease;
      }
      .kb-modal-backdrop .kb-pods-search:focus-within {
        border-color:rgba(124,255,178,.5);
        box-shadow:none;
      }
      .kb-modal-backdrop .kb-pods-table th { font-family:var(--font-jetbrains-mono),monospace; }
      .kb-modal-backdrop .kb-pods-table tbody tr { transition:background-color .14s ease,box-shadow .14s ease; }
      .kb-modal-backdrop .kb-pods-table tbody tr:hover { box-shadow:inset 2px 0 0 rgba(124,255,178,.55); }

      @media (prefers-reduced-motion:reduce) {
        .kb *, .kb *::before, .kb *::after { animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; scroll-behavior:auto!important; }
      }
    `}} />
  );
}
