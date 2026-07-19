'use client';

interface PR {
  id: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  opened: string;
  risk: 'high' | 'medium' | 'safe';
  diff: string;
  reason: string;
  commented: boolean;
}

// No GitHub integration wired up yet — this is placeholder shape data
// so the screen renders the full designed UI. Replace with a real
// GET /pr-risk backend call once GitHub App/webhook is connected.
const SAMPLE_PRS: PR[] = [
  {
    id: '1', number: 247, title: 'Reduce payment-svc memory limit for cost savings',
    author: 'jdoe', branch: 'fix/mem-limits', opened: '2h ago', risk: 'high',
    diff: 'resources:\n  limits:\n-   memory: 512Mi\n+   memory: 256Mi',
    reason: 'P95 usage is 410Mi, P99 is 460Mi. New limit of 256Mi will trigger OOMKilled within minutes of peak traffic.',
    commented: true,
  },
  {
    id: '2', number: 251, title: 'Bump order-api replicas for Black Friday',
    author: 'asingh', branch: 'chore/scale-order-api', opened: '5h ago', risk: 'medium',
    diff: 'spec:\n-   replicas: 3\n+   replicas: 8',
    reason: 'Node pool has capacity for +5 replicas, but HPA thresholds are unset — may cause uneven scheduling.',
    commented: true,
  },
  {
    id: '3', number: 253, title: 'Update nginx-ingress annotations',
    author: 'mchen', branch: 'infra/ingress-tls', opened: '1d ago', risk: 'safe',
    diff: '', reason: '', commented: false,
  },
];

export default function PRRiskScreen() {
  const flagged = SAMPLE_PRS.filter(p => p.risk !== 'safe').length;

  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">PR Risk</h1>
          <p className="kb-welcome-sub">Kubric has analysed {SAMPLE_PRS.length} PRs this week · {flagged} flagged</p>
        </div>
      </div>

      <div className="kb-pr-note">
        <span>ℹ</span> Connect a GitHub App to enable live PR risk scanning. Showing example assessments below.
      </div>

      <div className="kb-pr-list">
        {SAMPLE_PRS.map(pr => (
          <div key={pr.id} className={`kb-pr-card ${pr.risk}`}>
            <div className="kb-pr-head">
              <span className={`kb-risk-badge ${pr.risk}`}>{pr.risk}</span>
              <div className="kb-pr-title-wrap">
                <span className="kb-pr-title">{pr.title}</span>
                <span className="kb-pr-number">#{pr.number}</span>
              </div>
              <span className={`kb-pr-status ${pr.risk}`}>
                {pr.risk === 'high' ? 'will break' : pr.risk === 'medium' ? 'review needed' : 'clear to merge'}
              </span>
            </div>
            <div className="kb-pr-meta">opened by @{pr.author} · {pr.opened} · {pr.branch}</div>

            {pr.risk !== 'safe' && (
              <div className="kb-pr-body">
                <div>
                  <span className="kb-field-label">What changed</span>
                  <code className="kb-code">{pr.diff}</code>
                </div>
                <div>
                  <span className="kb-field-label">Why it will break</span>
                  <p className="kb-explanation">{pr.reason}</p>
                </div>
              </div>
            )}

            <div className="kb-pr-foot">
              {pr.commented && <span className="kb-pr-commented">✓ Kubric commented on PR</span>}
              <div className="kb-pr-actions">
                <button className="kb-btn" disabled title="Connect the GitHub App to open live pull requests">View PR</button>
                {pr.risk === 'high' && <button className="kb-btn primary" disabled title="Connect the GitHub App to post suggested fixes">Suggest fix on PR</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
