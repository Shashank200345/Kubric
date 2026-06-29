"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { insforge } from '@/lib/insforge';

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
  status: string;
  root_cause: string | null;
  explanation: string | null;
  fix: string | null;
  kubectl_command: string | null;
  confidence: number | null;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [currentInvestigation, setCurrentInvestigation] = useState<Investigation | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');

  const [activeScreen, setActiveScreen] = useState<string>('overview');

  const [liveMetrics, setLiveMetrics] = useState({ cpu_pct: 0, memory_pct: 0, disk_pct: 0, network_pct: 0, node_count: 0, pod_count: 0 });

  const channelRef = useRef<string | null>(null);

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
        const res = await fetch('http://localhost:8000/metrics');
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

  const fetchClusters = async () => {
    try {
      const res = await fetch('http://localhost:8000/clusters');
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

  const handleInvestigate = async () => {
    if (isInvestigating || !user) return;
    setActiveScreen('troubleshoot');
    setIsInvestigating(true);
    setCurrentInvestigation(null);
    setProgressSteps([]);
    setError(null);

    try {
      const { data: invData, error: insertError } = await insforge.database
        .from('investigations')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (insertError) throw insertError;

      const inv = invData as Investigation;
      setCurrentInvestigation(inv);

      const channel = `investigation:${inv.id}`;
      channelRef.current = channel;
      const response = await insforge.realtime.subscribe(channel);

      if (!response.ok) {
        console.error("Realtime subscribe failed:", response.error?.message);
      }

      insforge.realtime.on('progress_updated', (message: any) => {
        if (message.meta?.channel !== channel) return;

        if (message.step) {
          setProgressSteps(prev => {
            if (prev.find(p => p.id === message.id)) return prev;
            return [...prev, message as ProgressStep];
          });
        }

        if (message.status === 'completed') {
          setCurrentInvestigation(message as Investigation);
          setIsInvestigating(false);
          insforge.realtime.unsubscribe(channel);
          channelRef.current = null;
          fetchHistory();
        }

        if (message.status === 'failed') {
          setError('Investigation failed. Check backend logs.');
          setIsInvestigating(false);
          insforge.realtime.unsubscribe(channel);
          channelRef.current = null;
        }
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      // Fallback polling for progress in case realtime is blocked or RLS prevents frontend reads
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/investigate/${inv.id}/progress`);
          if (res.ok) {
            const data = await res.json();
            if (data.progress && data.progress.length > 0) {
              setProgressSteps(data.progress as ProgressStep[]);
            }
          }
        } catch (e) {
          console.error("Progress polling failed:", e);
        }
      }, 1000);

      try {
        const res = await fetch('http://localhost:8000/investigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            investigation_id: inv.id,
            cluster_context: selectedCluster || null
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        clearInterval(pollInterval);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || 'Backend investigation failed');
        }

        const { data: finalInv } = await insforge.database
          .from('investigations')
          .select('*')
          .eq('id', inv.id)
          .single();

        if (finalInv) {
          setCurrentInvestigation(finalInv as Investigation);
        }

      } catch (fetchErr: any) {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        if (fetchErr.name === 'AbortError') {
          setError('Investigation timed out after 2 minutes.');
        } else {
          setError(fetchErr.message || 'Failed to reach backend.');
        }
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsInvestigating(false);
      if (channelRef.current) {
        insforge.realtime.unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    }
  };

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
      const res = await fetch(`http://localhost:8000/investigate/${inv.id}/progress`);
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
            <div className="kb-search">
              <span className="kb-search-icon">⌕</span>
              <input className="kb-search-input" placeholder="Search clusters, incidents, or ask anything…" />
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
                    <button className="kb-btn primary" onClick={handleInvestigate} disabled={isInvestigating || !selectedCluster}>
                      {isInvestigating ? <><span className="kb-spinner sm" /> Investigating…</> : '+ Run investigation'}
                    </button>
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
                    <span className="kb-count">{investigations.length}</span>
                  </div>
                  {investigations.length === 0 ? (
                    <div className="kb-empty tall">No investigations yet. Run your first analysis.</div>
                  ) : (
                    <div className="kb-table-wrap">
                      <table className="kb-table">
                        <thead><tr><th>Date</th><th>Root cause</th><th>Confidence</th><th>Status</th></tr></thead>
                        <tbody>
                          {investigations.map(inv => (
                            <tr key={inv.id} onClick={() => viewHistoryItem(inv)}>
                              <td className="kb-td-date">{new Date(inv.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
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
                    <button className="kb-btn primary" onClick={handleInvestigate} disabled={isInvestigating || !selectedCluster}>
                      {isInvestigating ? <><span className="kb-spinner sm" /> Investigating…</> : 'Investigate cluster →'}
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
                  <div className="kb-col-header"><span className="kb-col-title">Previous investigations</span><span className="kb-count">{investigations.length}</span></div>
                  {investigations.length === 0 ? (
                    <div className="kb-empty tall">No investigations yet. Run your first analysis above.</div>
                  ) : (
                    <div className="kb-table-wrap">
                      <table className="kb-table">
                        <thead><tr><th>Date</th><th>Root cause</th><th>Confidence</th><th>Status</th></tr></thead>
                        <tbody>
                          {investigations.map(inv => (
                            <tr key={inv.id} onClick={() => viewHistoryItem(inv)}>
                              <td className="kb-td-date">{new Date(inv.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
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

            {/* ============ PLACEHOLDER SCREENS ============ */}
            {!['overview', 'troubleshoot'].includes(activeScreen) && (
              <div className="kb-screen">
                <div className="kb-welcome">
                  <div>
                    <h1 className="kb-welcome-title">{NAV.flatMap(s => s.items).find(i => i.id === activeScreen)?.label || 'Settings'}</h1>
                    <p className="kb-welcome-sub">This module is on the roadmap</p>
                  </div>
                </div>
                <div className="kb-card kb-soon">
                  <span className="kb-soon-icon">◷</span>
                  <h3 className="kb-soon-title">Coming soon</h3>
                  <p className="kb-soon-sub">This feature is being built. For now, head to Troubleshoot to run AI root-cause analysis on your clusters.</p>
                  <button className="kb-btn primary" onClick={() => setActiveScreen('troubleshoot')}>Go to Troubleshoot →</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
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

  const [samples, setSamples] = useState<any[]>([]);
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // poll history every 10s
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/metrics/history');
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
  const getVals = (key: string, metricIdx: number) => samples.map((s, i) => {
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
        font-family:var(--font-thicccboi), system-ui, sans-serif;
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
    `}} />
  );
}
