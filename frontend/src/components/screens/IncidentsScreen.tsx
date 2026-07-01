'use client';

import { useState } from 'react';

interface Investigation {
  id: string;
  status: string;
  root_cause: string | null;
  explanation: string | null;
  fix: string | null;
  kubectl_command: string | null;
  confidence: number | null;
  created_at: string;
}

export default function IncidentsScreen({ investigations }: { investigations: Investigation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const withIssues = investigations.filter(i => i.root_cause);
  const resolved = investigations.filter(i => !i.root_cause && i.status === 'completed');

  const filtered = filter === 'open' ? withIssues : filter === 'resolved' ? resolved : investigations;

  const mttd = withIssues.length
    ? Math.round(withIssues.reduce((acc, i) => acc + (i.confidence || 0), 0) / withIssues.length)
    : 0;

  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Incidents</h1>
          <p className="kb-welcome-sub">Full investigation history · RCA · fix record · audit trail</p>
        </div>
      </div>

      <div className="kb-stat-row">
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">△</span><span className="kb-statcard-label">Open issues</span></div>
          <div className={`kb-statcard-val ${withIssues.length > 0 ? 'crit' : 'ok'}`}>{withIssues.length}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">root causes found</span></div>
        </div>
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">✓</span><span className="kb-statcard-label">Resolved</span></div>
          <div className="kb-statcard-val ok">{resolved.length}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">clean investigations</span></div>
        </div>
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">◎</span><span className="kb-statcard-label">Avg confidence</span></div>
          <div className="kb-statcard-val">{mttd}%</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">across flagged issues</span></div>
        </div>
        <div className="kb-statcard">
          <div className="kb-statcard-top"><span className="kb-statcard-icon">⟲</span><span className="kb-statcard-label">Total runs</span></div>
          <div className="kb-statcard-val">{investigations.length}</div>
          <div className="kb-statcard-foot"><span className="kb-statcard-meta">all time</span></div>
        </div>
      </div>

      <div className="kb-card">
        <div className="kb-col-header">
          <span className="kb-col-title">All incidents</span>
          <span className="kb-count">{filtered.length}</span>
          <div className="kb-filterbar">
            {(['all', 'open', 'resolved'] as const).map(f => (
              <button key={f} className={`kb-filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="kb-empty tall">No incidents in this filter.</div>
        ) : (
          <div>
            {filtered.map(inv => {
              const isOpen = expanded === inv.id;
              const critical = !!inv.root_cause;
              return (
                <div key={inv.id} className="kb-inc-row-wrap">
                  <div
                    className={`kb-inc-row ${critical ? 'crit' : 'ok'}`}
                    onClick={() => setExpanded(isOpen ? null : inv.id)}
                  >
                    <span className={`kb-inc-dot ${critical ? 'crit' : 'ok'}`} />
                    <div className="kb-inc-main">
                      <div className="kb-inc-service">{inv.root_cause || 'Healthy scan'}</div>
                      <div className="kb-inc-desc">{inv.explanation || 'No issues detected during this investigation.'}</div>
                    </div>
                    <span className="kb-inc-time">{new Date(inv.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="kb-inc-chevron">{isOpen ? '▾' : '▸'}</span>
                  </div>

                  {isOpen && (
                    <div className="kb-inc-detail">
                      {critical ? (
                        <>
                          <div className="kb-inc-timeline">
                            <div className="kb-tl-item"><span className="kb-tl-dot" />Investigation started</div>
                            <div className="kb-tl-item"><span className="kb-tl-dot" />Root cause identified — {inv.root_cause}</div>
                            {inv.fix && <div className="kb-tl-item"><span className="kb-tl-dot ok" />Fix suggested</div>}
                          </div>
                          <div className="kb-nested">
                            <span className="kb-field-label">Explanation</span>
                            <p className="kb-explanation">{inv.explanation}</p>
                          </div>
                          {inv.fix && (
                            <div>
                              <span className="kb-field-label accent">Suggested fix</span>
                              <p className="kb-fix">{inv.fix}</p>
                            </div>
                          )}
                          {inv.kubectl_command && (
                            <div>
                              <span className="kb-field-label">Command</span>
                              <code className="kb-code">{inv.kubectl_command}</code>
                            </div>
                          )}
                          {inv.confidence != null && inv.confidence > 0 && (
                            <div className="kb-confidence">
                              <div className="kb-confidence-head"><span className="kb-field-label">AI confidence</span><span className="kb-confidence-val">{inv.confidence}%</span></div>
                              <div className="kb-bar"><div className="kb-bar-fill" style={{ width: `${inv.confidence}%` }} /></div>
                            </div>
                          )}
                          <div className="kb-audit">Diagnosed by Kubric (autonomous) · investigation #{inv.id.slice(0, 8)}</div>
                        </>
                      ) : (
                        <div className="kb-inc-timeline">
                          <div className="kb-tl-item"><span className="kb-tl-dot ok" />Scan completed — no critical issues found</div>
                        </div>
                      )}
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
