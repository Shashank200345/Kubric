'use client';

import { useState } from 'react';

const CATEGORIES = ['Clusters', 'Integrations', 'Trust & Automation', 'Notifications', 'Team', 'API Keys', 'Billing'];

const TRUST_MODES = [
  { id: 'suggest', name: 'Suggest', desc: 'Kubric shows you what to do. You do it. Zero automated actions.' },
  { id: 'approve', name: 'Approve', desc: 'Kubric prepares the fix. You confirm with one click. Full control.' },
  { id: 'auto', name: 'Auto-fix', desc: 'Kubric fixes defined issue categories automatically. Set the boundaries below.' },
];

const ISSUE_CATEGORIES = ['OOMKill', 'CrashLoopBackOff', 'ImagePullBackOff', 'Node pressure', 'Pending pods'];

export default function SettingsScreen({ user, selectedCluster, clusters }: { user: any; selectedCluster: string; clusters: string[] }) {
  const [category, setCategory] = useState('Trust & Automation');
  const [trustMode, setTrustMode] = useState('approve');
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({
    'OOMKill': true, 'CrashLoopBackOff': true, 'ImagePullBackOff': false, 'Node pressure': false, 'Pending pods': false,
  });

  const toggle = (cat: string) => setEnabledCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Settings</h1>
          <p className="kb-welcome-sub">{user?.email}</p>
        </div>
      </div>

      <div className="kb-settings-grid">
        <div className="kb-settings-nav">
          {CATEGORIES.map(c => (
            <button key={c} className={`kb-nav-item ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)} style={{ width: '100%' }}>
              {c}
            </button>
          ))}
        </div>

        <div className="kb-settings-content">
          {category === 'Trust & Automation' && (
            <div className="kb-card" style={{ padding: 20 }}>
              <p className="kb-field-label" style={{ marginBottom: 16 }}>Fix workflow</p>
              {TRUST_MODES.map(mode => (
                <div
                  key={mode.id}
                  className={`kb-trust-card ${trustMode === mode.id ? 'selected' : ''}`}
                  onClick={() => setTrustMode(mode.id)}
                >
                  <span className={`kb-radio ${trustMode === mode.id ? 'on' : ''}`} />
                  <div>
                    <div className="kb-trust-name">{mode.name}</div>
                    <div className="kb-trust-desc">{mode.desc}</div>
                  </div>
                </div>
              ))}

              {trustMode === 'auto' && (
                <div className="kb-issue-toggles">
                  <p className="kb-field-label" style={{ margin: '18px 0 10px' }}>Auto-fix boundaries</p>
                  {ISSUE_CATEGORIES.map(cat => (
                    <div key={cat} className="kb-toggle-row">
                      <span>{cat}</span>
                      <button className={`kb-switch ${enabledCategories[cat] ? 'on' : ''}`} onClick={() => toggle(cat)}>
                        <span className="kb-switch-knob" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {category === 'Clusters' && (
            <div className="kb-card" style={{ padding: 20 }}>
              <p className="kb-field-label" style={{ marginBottom: 12 }}>Connected clusters</p>
              {clusters.length === 0 ? (
                <p className="kb-explanation">No clusters detected via kubeconfig.</p>
              ) : (
                clusters.map(c => (
                  <div key={c} className="kb-toggle-row">
                    <span>{c}</span>
                    {c === selectedCluster ? <span className="kb-tag teal">active</span> : <span className="kb-tag">idle</span>}
                  </div>
                ))
              )}
            </div>
          )}

          {!['Trust & Automation', 'Clusters'].includes(category) && (
            <div className="kb-card kb-soon" style={{ minHeight: 260 }}>
              <span className="kb-soon-icon">◷</span>
              <h3 className="kb-soon-title">{category}</h3>
              <p className="kb-soon-sub">This settings section is on the roadmap.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
