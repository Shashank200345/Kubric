'use client';

interface Playbook {
  category: string;
  title: string;
  desc: string;
  uses: number;
  lastRun: string;
  builtin: boolean;
  running?: boolean;
}

const PLAYBOOKS: Playbook[] = [
  { category: 'OOMKill', title: 'Right-size memory limits', desc: 'Detects OOMKilled pods, correlates with actual usage, and proposes a safe new memory limit.', uses: 14, lastRun: '2h ago', builtin: true, running: false },
  { category: 'CrashLoop', title: 'Diagnose CrashLoopBackOff', desc: 'Reads container exit codes and recent logs to identify the failing command or dependency.', uses: 22, lastRun: '30m ago', builtin: true, running: true },
  { category: 'ImagePull', title: 'Fix ImagePullBackOff', desc: 'Checks image tag existence, registry auth, and imagePullSecrets to find the exact cause.', uses: 9, lastRun: '1d ago', builtin: true },
  { category: 'Networking', title: 'Trace 5xx across services', desc: 'Walks the request path through ingress, service mesh, and CoreDNS to find the failing hop.', uses: 6, lastRun: '3d ago', builtin: true },
  { category: 'Scheduling', title: 'Explain pending pods', desc: 'Checks taints, affinity rules, and resource quotas to explain why a pod is stuck Pending.', uses: 11, lastRun: '6h ago', builtin: true },
  { category: 'Custom', title: 'Weekly cost anomaly scan', desc: 'Team-authored playbook that flags namespaces with sudden resource request increases.', uses: 3, lastRun: '5d ago', builtin: false },
];

export default function PlaybooksScreen() {
  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Playbooks</h1>
          <p className="kb-welcome-sub">{PLAYBOOKS.filter(p => p.builtin).length} built-in · {PLAYBOOKS.filter(p => !p.builtin).length} custom</p>
        </div>
        <div className="kb-welcome-actions">
          <button className="kb-btn primary">+ New playbook</button>
        </div>
      </div>

      <div className="kb-playbook-grid">
        {PLAYBOOKS.map(p => (
          <div key={p.title} className="kb-card kb-playbook-card">
            <div className="kb-playbook-top">
              <span className="kb-tag teal">{p.category}</span>
              <span className="kb-playbook-source">{p.builtin ? 'Built-in' : 'Custom'}</span>
            </div>
            <h3 className="kb-playbook-title">{p.title}</h3>
            <p className="kb-playbook-desc">{p.desc}</p>
            <div className="kb-playbook-foot">
              {p.running ? (
                <span className="kb-playbook-running"><span className="kb-dot pulse" /> Running now</span>
              ) : (
                <span>Used {p.uses} times</span>
              )}
              <span>Last triggered: {p.lastRun}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
