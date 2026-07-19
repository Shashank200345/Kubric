'use client';

import { useEffect, useState } from 'react';
import KubricStyles from '@/components/KubricStyles';

/**
 * Hero product visual — the REAL Kubric dashboard UI (same kb-* classes and
 * KubricStyles as the live app), auto-cycling through its screens with the
 * sidebar highlight following along. Framed and faded at the bottom.
 * Static presentation only (no data fetching / interactions).
 */

const NAV = [
  { group: 'Monitor', items: [
    { id: 'overview', label: 'Overview', icon: '▦' },
    { id: 'incidents', label: 'Incidents', icon: '△', badge: '3', crit: true },
    { id: 'workloads', label: 'Workloads', icon: '◲' },
    { id: 'nodes', label: 'Nodes', icon: '▧' },
  ]},
  { group: 'Automate', items: [
    { id: 'playbooks', label: 'Playbooks', icon: '⚙' },
    { id: 'prrisk', label: 'PR Risk', icon: '⑃' },
  ]},
];

const SCREENS = ['overview', 'incidents', 'workloads'] as const;

/* ---------------- screen mockups (real kb-* markup) ---------------- */

function Overview() {
  const stats = [
    { icon: '⬡', label: 'Nodes', val: '1', meta: 'active in cluster', tone: '' },
    { icon: '◎', label: 'Pods running', val: '24', meta: 'across all namespaces', tone: 'ok' },
    { icon: '△', label: 'Issues found', val: '3', meta: 'root causes identified', tone: 'crit' },
    { icon: '✓', label: 'Investigations', val: '12', meta: '9 healthy · 3 issues', tone: '' },
  ];
  const bars = [40, 62, 48, 74, 55, 38, 66, 44, 58, 34, 50, 30, 46, 26];
  const meters = [{ k: 'CPU', v: 42 }, { k: 'Memory', v: 61 }, { k: 'Disk', v: 28 }];
  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Welcome back, <span className="accent">prod team</span></h1>
          <p className="kb-welcome-sub">1 cluster connected · 12 recent investigations</p>
        </div>
        <div className="kb-welcome-actions">
          <span className="kb-agent-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 500 }}>
            <span className="kb-dot pulse" style={{ background: '#38bdf8' }} /> Agent active
          </span>
        </div>
      </div>

      <div className="kb-stat-row">
        {stats.map((s) => (
          <div className="kb-statcard" key={s.label}>
            <div className="kb-statcard-top">
              <span className="kb-statcard-icon">{s.icon}</span>
              <span className="kb-statcard-label">{s.label}</span>
              <span className="kb-statcard-dots">⋯</span>
            </div>
            <div className={`kb-statcard-val ${s.tone}`}>{s.val}</div>
            <div className="kb-statcard-foot"><span className="kb-statcard-meta">{s.meta}</span></div>
          </div>
        ))}
      </div>

      <div className="kb-grid-2">
        <div className="kb-card">
          <div className="kb-col-header"><span className="kb-col-title">Cluster signal · live</span></div>
          <div className="kb-chart-wrap">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '120px' }}>
              {bars.map((h, i) => (
                <span key={i} style={{ flex: 1, height: `${h}%`, background: i > 9 ? 'rgba(124,255,178,0.3)' : '#7cffb2', opacity: 0.85 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="kb-card">
          <div className="kb-col-header"><span className="kb-col-title">Resource usage · live</span></div>
          <div className="kb-meters">
            {meters.map((m) => (
              <div className="kb-meter" key={m.k}>
                <div className="kb-meter-head"><span>{m.k}</span><span className="kb-meter-pct">{m.v}%</span></div>
                <div className="kb-segbar">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="kb-seg" style={i < Math.round(m.v / 5) ? { background: '#7cffb2' } : undefined} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Incidents() {
  const stats = [
    { icon: '△', label: 'Active incidents', val: '3', tone: 'crit', meta: 'in kind-kind' },
    { icon: '●', label: 'Critical', val: '1', tone: 'crit', meta: 'pods actively broken' },
    { icon: '⚠', label: 'Warnings', val: '2', tone: '', meta: 'restarts / probe fails' },
    { icon: '◲', label: 'Namespaces hit', val: '3', tone: '', meta: 'out of the cluster' },
  ];
  const incs = [
    { sev: 'critical', glyph: '⤓', title: "nginx-imagepullbackoff: can't download the image", why: "The image tag doesn't exist in the registry.", ns: 'default', pod: 'nginx-imagepullbackoff', type: 'ImagePullBackOff', cnt: '×8013' },
    { sev: 'warning', glyph: '↻', title: 'coredns restarted 5 times', why: 'Pods have restarted — possible intermittent crashes.', ns: 'kube-system', pod: 'coredns', type: 'BackOff', cnt: '×5' },
  ];
  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Incidents</h1>
          <p className="kb-welcome-sub">What&apos;s breaking in <b style={{ color: 'var(--green)' }}>kind-kind</b> right now</p>
        </div>
        <div className="kb-welcome-actions">
          <span className="kb-live-tag"><span className="kb-live-dot" /> live · 10s</span>
        </div>
      </div>

      <div className="kb-stat-row">
        {stats.map((s) => (
          <div className="kb-statcard" key={s.label}>
            <div className="kb-statcard-top"><span className="kb-statcard-icon">{s.icon}</span><span className="kb-statcard-label">{s.label}</span></div>
            <div className={`kb-statcard-val ${s.tone}`}>{s.val}</div>
            <div className="kb-statcard-foot"><span className="kb-statcard-meta">{s.meta}</span></div>
          </div>
        ))}
      </div>

      <div className="kb-card">
        <div className="kb-col-header"><span className="kb-col-title">Live incidents</span><span className="kb-count">3</span></div>
        {incs.map((i) => (
          <div className="kb-incx-wrap" key={i.pod}>
            <div className={`kb-incx ${i.sev}`}>
              <span className={`kb-incx-icon ${i.sev}`}>{i.glyph}</span>
              <div className="kb-incx-body">
                <div className="kb-incx-title">{i.title}</div>
                <div className="kb-incx-why">{i.why}</div>
                <div className="kb-incx-loc">
                  <span className="kb-loc-chip"><span className="k">Cluster</span>kind-kind</span>
                  <span className="kb-loc-chip"><span className="k">Namespace</span>{i.ns}</span>
                  <span className="kb-loc-chip"><span className="k">Pod</span>{i.pod}</span>
                </div>
              </div>
              <div className="kb-incx-right">
                <span className={`kb-crash-badge ${i.sev}`}>{i.type}</span>
                <span className="kb-incx-meta"><span className="kb-incx-cnt">{i.cnt}</span><span className="kb-incx-time">2m ago</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Workloads() {
  const rows = [
    { name: 'payment-svc', ns: 'payments', pods: '0/3', rst: 7, st: 'crit', label: 'Down' },
    { name: 'order-api', ns: 'orders', pods: '2/3', rst: 2, st: 'run', label: 'Degraded' },
    { name: 'auth-svc', ns: 'platform', pods: '3/3', rst: 0, st: 'ok', label: 'Healthy' },
    { name: 'lookup-order', ns: 'default', pods: '1/1', rst: 0, st: 'ok', label: 'Healthy' },
    { name: 'worker-job', ns: 'jobs', pods: '1/1', rst: 1, st: 'ok', label: 'Healthy' },
  ];
  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Workloads</h1>
          <p className="kb-welcome-sub">Live deployment health across every namespace</p>
        </div>
        <div className="kb-welcome-actions"><span className="kb-live-tag"><span className="kb-live-dot" /> 14 total</span></div>
      </div>

      <div className="kb-card">
        <div className="kb-col-header"><span className="kb-col-title">Deployments</span><span className="kb-count">{rows.length}</span></div>
        <div className="kb-table-wrap">
          <table className="kb-table">
            <thead><tr><th>Workload</th><th>Namespace</th><th>Pods</th><th>Restarts</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="kb-td-cause">{r.name}</td>
                  <td>{r.ns}</td>
                  <td>{r.pods}</td>
                  <td><span className={r.rst > 0 ? 'kb-warn-text' : ''}>{r.rst}</span></td>
                  <td><span className={`kb-status ${r.st}`}>{r.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % SCREENS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const screen = SCREENS[active];

  return (
    <div className="dsh">
      <KubricStyles />
      <div className="kb kb-showcase">
        <div className="kb-shell">
          <aside className="kb-side">
            <div className="kb-side-logo">
              <img src="/kubric-logo.png" alt="Kubric" className="kb-side-logo-img" />
              <span className="kb-side-logo-name"><span style={{ color: '#7cffb2' }}>K</span><span style={{ color: '#f4f7f9' }}>UBRIC</span></span>
            </div>
            <nav className="kb-nav">
              {NAV.map((section) => (
                <div key={section.group} className="kb-nav-section">
                  <div className="kb-nav-label">{section.group}</div>
                  {section.items.map((item) => (
                    <button key={item.id} className={`kb-nav-item ${screen === item.id ? 'active' : ''}`}>
                      <span className="kb-nav-icon">{item.icon}</span> {item.label}
                      {item.badge && <span className={`kb-nav-badge ${item.crit ? 'crit' : ''}`}>{item.badge}</span>}
                    </button>
                  ))}
                </div>
              ))}
              <div className="kb-nav-section kb-nav-support">
                <div className="kb-nav-label">Support</div>
                <button className="kb-nav-item"><span className="kb-nav-icon">✦</span> Ask Kubric</button>
                <button className="kb-nav-item"><span className="kb-nav-icon">⚙</span> Settings</button>
              </div>
            </nav>
            <div className="kb-profile">
              <div className="kb-avatar">PT</div>
              <div className="kb-profile-info">
                <div className="kb-profile-name">prod team</div>
                <div className="kb-profile-mail">ops@kubric.dev</div>
              </div>
              <button className="kb-profile-out">⏻</button>
            </div>
          </aside>

          <div className="kb-maincol">
            <header className="kb-topbar">
              <div className="kb-search">
                <span className="kb-search-icon">⌕</span>
                <input className="kb-search-input" placeholder="Search clusters, incidents, or ask anything…" readOnly />
                <span className="kb-kbd">⌘K</span>
              </div>
              <div className="kb-topbar-right">
                <button className="kb-icon-btn">↻</button>
                <span className="kb-cluster-pill"><span className="kb-dot" /> kind-kind</span>
              </div>
            </header>

            <div className="kb-scroll">
              <div className="dsh-swap" key={screen}>
                {screen === 'overview' && <Overview />}
                {screen === 'incidents' && <Incidents />}
                {screen === 'workloads' && <Workloads />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dsh { position: relative; width: 100%; max-width: 1120px; margin: 0 auto; }
        .kb-showcase {
          position: relative; overflow: hidden;
          border: 1px solid rgba(124,255,178,0.18); border-bottom: none;
          box-shadow: 0 -1px 0 rgba(124,255,178,0.1) inset, 0 40px 120px -30px rgba(124,255,178,0.14);
          -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 60%, transparent 99%);
          mask-image: linear-gradient(to bottom, #000 0%, #000 60%, transparent 99%);
          pointer-events: none; user-select: none;
        }
        .kb-showcase .kb-shell { height: 580px; }
        .kb-showcase .kb-scroll { overflow: hidden; }
        .dsh-swap { animation: dsh-in .5s cubic-bezier(0.22,1,0.36,1); }
        @keyframes dsh-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (max-width: 760px) {
          .kb-showcase .kb-shell { grid-template-columns: 1fr; height: 460px; }
          .kb-showcase .kb-side { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .dsh-swap { animation: none; } }
      `}</style>
    </div>
  );
}
