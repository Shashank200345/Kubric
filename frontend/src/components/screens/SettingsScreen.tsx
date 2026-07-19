'use client';

import { useState } from 'react';
import { insforge } from '@/lib/insforge';

const CATEGORIES = ['Clusters', 'Integrations', 'Trust & Automation', 'Notifications', 'Team', 'API Keys', 'Billing'];

const TRUST_MODES = [
  { id: 'suggest', name: 'Suggest', desc: 'Kubric shows you what to do. You do it. Zero automated actions.' },
  { id: 'approve', name: 'Approve', desc: 'Kubric prepares the fix. You confirm with one click. Full control.' },
  { id: 'auto', name: 'Auto-fix', desc: 'Kubric fixes defined issue categories automatically. Set the boundaries below.' },
];

const ISSUE_CATEGORIES = ['OOMKill', 'CrashLoopBackOff', 'ImagePullBackOff', 'Node pressure', 'Pending pods'];

export default function SettingsScreen({ user, selectedCluster, clusters, fetchClusters }: { user: { id: string; email?: string; [key: string]: unknown } | null; selectedCluster: string; clusters: string[], fetchClusters?: () => void }) {
  const [category, setCategory] = useState('Clusters');
  const [trustMode, setTrustMode] = useState('approve');
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({
    'OOMKill': true, 'CrashLoopBackOff': true, 'ImagePullBackOff': false, 'Node pressure': false, 'Pending pods': false,
  });

  const [newClusterName, setNewClusterName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const toggle = (cat: string) => setEnabledCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const handleAddCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClusterName.trim() || !user?.id) return;
    
    setIsAdding(true);
    const { data, error } = await insforge.database
      .from('clusters')
      .insert([{ user_id: user.id, cluster_name: newClusterName.trim() }])
      .select('cluster_token')
      .single();

    if (!error && data) {
      setGeneratedToken(data.cluster_token);
      if (fetchClusters) fetchClusters();
    } else {
      console.error("Failed to generate cluster token:", error);
    }
    setIsAdding(false);
  };

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="kb-card" style={{ padding: 20 }}>
                <p className="kb-field-label" style={{ marginBottom: 12 }}>Connected clusters</p>
                {clusters.length === 0 ? (
                  <p className="kb-explanation">No clusters connected yet.</p>
                ) : (
                  clusters.map(c => (
                    <div key={c} className="kb-toggle-row">
                      <span>{c}</span>
                      {c === selectedCluster ? <span className="kb-tag teal">active</span> : <span className="kb-tag">idle</span>}
                    </div>
                  ))
                )}
              </div>

              <div className="kb-card" style={{ padding: 20 }}>
                <p className="kb-field-label" style={{ marginBottom: 12 }}>Add new cluster</p>
                
                {!generatedToken ? (
                  <form onSubmit={handleAddCluster} style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      className="kb-search-input" 
                      placeholder="e.g. production-eks" 
                      value={newClusterName}
                      onChange={e => setNewClusterName(e.target.value)}
                      required
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--bd)', background: 'var(--bg)' }}
                    />
                    <button type="submit" className="kb-btn" disabled={isAdding || !newClusterName.trim()}>
                      {isAdding ? 'Generating...' : 'Generate Token'}
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="kb-explanation" style={{ color: 'var(--green)' }}>✓ Token generated successfully. Run this command to install the agent:</div>
                    <pre style={{ background: 'var(--bg)', padding: '16px', border: '1px solid var(--green-bd)', color: 'var(--t1)', fontSize: '12px', overflowX: 'auto', lineHeight: '1.6', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
{`helm install kubric-agent ./kubric-agent \\
  -n kubric-system --create-namespace \\
  --set agent.clusterToken=${generatedToken} \\
  --set agent.clusterName=${newClusterName} \\
  --set agent.ingestionEndpoint=https://api.kubric.com/api/v1/ingest`}
                    </pre>
                    <button className="kb-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { setGeneratedToken(null); setNewClusterName(''); }}>
                      Add another cluster
                    </button>
                  </div>
                )}
              </div>
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