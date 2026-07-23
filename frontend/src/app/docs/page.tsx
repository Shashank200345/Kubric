'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './docs.css';

/**
 * Screenshot / illustration slot.
 * Drop a real capture at /public/docs/<file> and it renders automatically;
 * until then it shows a labeled placeholder describing what to capture.
 */
function Shot({ file, alt, caption, window: win }: { file: string; alt: string; caption?: string; window?: string }) {
  const [ok, setOk] = useState(true);
  const src = `/docs/${file}`;
  return (
    <figure className="docs-shot">
      <div className="docs-shot-frame">
        {win && (
          <div className="docs-shot-bar">
            <span className="d r" /><span className="d y" /><span className="d g" />
            <span className="u">{win}</span>
          </div>
        )}
        {ok ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} onError={() => setOk(false)} />
        ) : (
          <>
            <span className="docs-shot-badge">screenshot</span>
            <span className="docs-shot-hint">{`public/docs/${file}`}</span>
            <span className="docs-shot-hint" style={{ opacity: 0.7 }}>{alt}</span>
          </>
        )}
      </div>
      {caption && <figcaption className="docs-shot-cap">{caption}</figcaption>}
    </figure>
  );
}

const NAV = [
  {
    group: 'Getting started',
    items: [
      { id: 'overview', label: 'What is Kubric' },
      { id: 'prerequisites', label: 'Prerequisites' },
      { id: 'quickstart', label: 'Quick start' },
    ],
  },
  {
    group: 'Onboarding',
    items: [
      { id: 'signup', label: 'Create your account' },
      { id: 'wizard', label: 'Onboarding wizard' },
      { id: 'connect', label: 'Connect a cluster' },
      { id: 'trust', label: 'Trust modes' },
    ],
  },
  {
    group: 'Dashboard tour',
    items: [
      { id: 'overview-screen', label: 'Overview' },
      { id: 'incidents', label: 'Incidents' },
      { id: 'troubleshoot', label: 'Troubleshoot' },
      { id: 'workloads', label: 'Workloads' },
      { id: 'nodes', label: 'Nodes' },
      { id: 'settings', label: 'Settings' },
    ],
  },
  {
    group: 'How it works',
    items: [
      { id: 'architecture', label: 'Architecture' },
      { id: 'autofix', label: 'What Kubric can fix' },
      { id: 'security', label: 'Security' },
      { id: 'faq', label: 'Troubleshooting & FAQ' },
    ],
  },
];

export default function DocsPage() {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const ids = NAV.flatMap((g) => g.items.map((i) => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs">
      {/* top bar */}
      <header className="docs-top">
        <Link href="/" className="docs-brand">
          <img src="/kubric-logo.png" alt="Kubric" />
          <span className="docs-brand-name"><span className="k">K</span>UBRIC</span>
        </Link>
        <nav className="docs-top-actions">
          <Link href="/">Home</Link>
          <a href="#quickstart">Quick start</a>
          <Link href="/login" className="docs-cta">Open dashboard →</Link>
        </nav>
      </header>

      <div className="docs-shell">
        {/* sidebar */}
        <aside className="docs-side">
          {NAV.map((g) => (
            <div className="docs-side-group" key={g.group}>
              <h4>{g.group}</h4>
              {g.items.map((i) => (
                <a key={i.id} href={`#${i.id}`} className={active === i.id ? 'active' : ''}>
                  {i.label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        {/* content */}
        <main className="docs-main">
          {/* placeholder — sections injected below */}
          <DocsContent />
        </main>
      </div>
    </div>
  );
}

function DocsContent() {
  return (
    <>
      <section id="overview">
        <div className="docs-eyebrow">Documentation</div>
        <h1 className="docs-h1">Kubric — the autonomous SRE for Kubernetes</h1>
        <p className="docs-lede">
          Kubric connects to your Kubernetes clusters, detects failures, pinpoints the root cause
          with AI, and ships fixes — with you in control. This guide takes you from sign-up to your
          first one-click fix.
        </p>
        <Shot file="hero-dashboard.png" window="app.kubric.dev/dashboard" alt="Dashboard Overview: connected cluster, live metrics, incident count" caption="The Kubric dashboard once a cluster is connected." />
        <p>
          Kubric is <strong>push-based</strong>: a lightweight agent runs inside your cluster,
          collects state over outbound HTTPS, and Kubric reasons over it. Kubric never needs
          inbound access to your control plane, and no cluster credentials ever leave your
          environment.
        </p>
      </section>

      {/* ---------------- Prerequisites ---------------- */}
      <section id="prerequisites">
        <h2 className="docs-h2">Prerequisites</h2>
        <p>Before you connect a cluster, make sure you have:</p>
        <ul>
          <li><strong>A running Kubernetes cluster.</strong> Kubric does <strong>not</strong> create the cluster for you — you bring your own (kind, minikube, EKS, GKE, AKS, or any conformant cluster). Confirm access with <span className="docs-inline">kubectl get nodes</span>.</li>
          <li><strong>helm 3 and kubectl</strong> installed on the machine you run the install command from.</li>
          <li><strong>Outbound HTTPS</strong> from the cluster to the Kubric backend. The agent only makes outbound calls — no inbound firewall changes needed.</li>
          <li><strong>metrics-server (recommended)</strong> for CPU/memory numbers. On minikube: <span className="docs-inline">minikube addons enable metrics-server</span>. Without it, workloads and incidents still work; only CPU/memory show as 0.</li>
          <li><strong>A Kubric account</strong> (free for clusters under 10 nodes).</li>
        </ul>
        <div className="docs-note">
          <div className="t">Security by design</div>
          <p>The Kubric backend never connects into your cluster. The in-cluster agent pushes data outbound and runs with scoped, least-privilege RBAC.</p>
        </div>
      </section>

      {/* ---------------- Quick start ---------------- */}
      <section id="quickstart">
        <h2 className="docs-h2">Quick start</h2>
        <ol className="docs-steps">
          <li>
            <h4>Create an account and name your cluster</h4>
            <p>Sign up, then the onboarding wizard asks you to name the cluster (e.g. <span className="docs-inline">production-eks</span>) and generates a connection token.</p>
          </li>
          <li>
            <h4>Install the agent</h4>
            <p>Copy the Helm command shown for your shell and run it against your cluster:</p>
            <pre className="docs-code">{`helm install kubric-agent https://<your-backend>/install/kubric-agent-0.1.0.tgz \\
  -n kubric-system --create-namespace \\
  --set agent.token=<your-token> \\
  --set agent.clusterName=<your-cluster-name> \\
  --set agent.ingestionEndpoint=https://<your-backend>/api/v1/ingest`}</pre>
          </li>
          <li>
            <h4>Watch it connect</h4>
            <p>Within ~30 seconds the cluster appears in the dashboard with live data. That&apos;s it — no cluster credentials shared, no inbound access.</p>
          </li>
        </ol>
        <div className="docs-note">
          <div className="t">No repo clone needed</div>
          <p>The chart installs directly from a URL, so anyone with <span className="docs-inline">helm</span> and <span className="docs-inline">kubectl</span> can install the agent — no need to clone the project.</p>
        </div>
      </section>

      {/* ---------------- Sign up ---------------- */}
      <section id="signup">
        <h2 className="docs-h2">Create your account</h2>
        <p>Sign up with email + password (verified by a 6-digit code) or with Google/GitHub. Forgot your password? Use the <strong>Forgot?</strong> link — we email a reset code, then you set a new password.</p>
        <Shot file="signup.png" window="app.kubric.dev/login" alt="Sign-up / login screen with brand panel on the left and form on the right" caption="Sign up or sign in to reach your workspace." />
      </section>

      {/* ---------------- Wizard ---------------- */}
      <section id="wizard">
        <h2 className="docs-h2">Onboarding wizard</h2>
        <p>New accounts land in a guided wizard that takes you from zero to your first scan. A progress tracker on the left shows every step.</p>
        <ol className="docs-steps">
          <li><h4>Welcome</h4><p>A quick intro to what happens next.</p></li>
          <li><h4>Name your cluster</h4><p>Lowercase letters, numbers, and hyphens, 3–63 chars (e.g. <span className="docs-inline">staging-gke</span>).</p></li>
          <li><h4>Choose a connection method</h4><p>Web Token (generate a token + run Helm) or CLI (<span className="docs-inline">kubric login</span> then <span className="docs-inline">kubric connect</span>).</p></li>
          <li><h4>Connect the cluster</h4><p>Run the install command; Kubric waits for the agent to report in.</p></li>
          <li><h4>Select a trust mode</h4><p>Suggest, Approve (default), or Auto-fix — see below.</p></li>
          <li><h4>Invite your team (optional)</h4><p>Add teammates by email, or skip.</p></li>
          <li><h4>Awaiting first scan → done</h4><p>Once data arrives you get a summary and a “Go to dashboard” button.</p></li>
        </ol>
        <Shot file="wizard.png" window="app.kubric.dev/dashboard" alt="Onboarding wizard: left progress tracker (Welcome, Name Your Cluster, Choose Connection Method, Connect via Web Token, Select Trust Mode, Invite Team, Awaiting First Scan, Setup Complete) and the active step on the right" caption="The guided onboarding wizard with its progress tracker." />
      </section>

      {/* ---------------- Connect a cluster ---------------- */}
      <section id="connect">
        <h2 className="docs-h2">Connect a cluster</h2>
        <p>On the Web Token step, Kubric generates a per-cluster token and a ready-to-run Helm command. Pick the tab that matches your terminal — the command is formatted for <strong>macOS/Linux</strong>, <strong>PowerShell</strong>, or <strong>Windows CMD</strong> so it pastes and runs cleanly.</p>
        <Shot file="web-token.png" window="app.kubric.dev/dashboard" alt="Web Token step: token generated, shell tabs (macOS/Linux, PowerShell, Windows CMD), the Helm command, and a Copy button" caption="Generate a token and copy the Helm command for your shell." />
        <h3 className="docs-h3">Verify the agent is running</h3>
        <pre className="docs-code">{`kubectl -n kubric-system get pods
kubectl -n kubric-system logs -l app=kubric-agent --tail=20`}</pre>
        <p>You want the agent pod <span className="docs-inline">Running</span> and log lines like <span className="docs-inline">[agent] Pushed cluster state…</span>. Within ~30s the cluster populates in the dashboard.</p>
        <div className="docs-note warn">
          <div className="t">Two common gotchas</div>
          <p>1) The agent image must be pullable by your cluster (public registry). 2) For CPU/memory numbers, install metrics-server. Neither blocks incident detection or fixes.</p>
        </div>
      </section>

      {/* ---------------- Trust modes ---------------- */}
      <section id="trust">
        <h2 className="docs-h2">Trust modes</h2>
        <p>You decide how much autonomy Kubric has. Change it any time in Settings → Trust &amp; Automation.</p>
        <table className="docs-table">
          <thead><tr><th>Mode</th><th>What it does</th></tr></thead>
          <tbody>
            <tr><td><strong>Suggest</strong></td><td>Kubric shows the diagnosis and recommended fix. You run it yourself. Zero automated actions.</td></tr>
            <tr><td><strong>Approve</strong> <span className="docs-pill">default</span></td><td>Kubric prepares the fix and waits for your one-click approval before the in-cluster agent applies it.</td></tr>
            <tr><td><strong>Auto-fix</strong></td><td>Kubric remediates defined issue categories automatically, within the boundaries you set.</td></tr>
          </tbody>
        </table>
      </section>

      {/* ---------------- Overview screen ---------------- */}
      <section id="overview-screen">
        <h2 className="docs-h2">Dashboard · Overview</h2>
        <p>Your cluster at a glance: node and pod counts, issues found, and recent investigations, plus a live cluster-signal chart and resource-usage meters.</p>
        <Shot file="overview.png" window="app.kubric.dev/dashboard" alt="Overview: stat cards (Nodes, Pods running, Issues found, Investigations), Cluster Signal live chart, Resource usage meters" caption="Overview — health, activity, and live resource usage." />
      </section>

      {/* ---------------- Incidents ---------------- */}
      <section id="incidents">
        <h2 className="docs-h2">Dashboard · Incidents</h2>
        <p>Everything currently breaking in the cluster, ranked by severity. Kubric detects <span className="docs-inline">CrashLoopBackOff</span>, <span className="docs-inline">OOMKilled</span>, <span className="docs-inline">ImagePullBackOff</span>, repeated restarts, and more — each with a plain-English “why”, the affected resource, and the failure type.</p>
        <Shot file="incidents.png" window="app.kubric.dev/dashboard" alt="Incidents list: critical and warning cards with title, why-it-happened, cluster/namespace/pod chips, and failure type badge" caption="Live incidents with severity, location, and cause." />
      </section>

      {/* ---------------- Troubleshoot ---------------- */}
      <section id="troubleshoot">
        <h2 className="docs-h2">Dashboard · Troubleshoot</h2>
        <p>Select a cluster and click <strong>Scan Cluster</strong>. Kubric’s agent investigates step by step — checking pods, reading logs, analyzing events, inspecting deployments and networking — then the AI reasons over the evidence to produce a root cause.</p>
        <Shot file="troubleshoot-scan.png" window="app.kubric.dev/dashboard" alt="Troubleshoot: left progress checklist (Checking Pods, Reading Logs, Analyzing Events, Inspecting Deployments, Checking Networking, AI Reasoning, Root cause found), right panel with Root cause, Why it happened, Impact, Suggested fix, and evidence" caption="A scan result: root cause, impact, evidence, and a suggested fix." />
        <h3 className="docs-h3">Approve &amp; Run Fix</h3>
        <p>When the fix is safe and deterministic, Kubric offers a one-click <strong>Approve &amp; Run Fix</strong>. In Approve mode, nothing touches your cluster until you click — then the in-cluster agent applies the fix with its own RBAC and reports the result back.</p>
        <Shot file="fix-applied.png" window="app.kubric.dev/dashboard" alt="Automated remediation card showing the action, the exact kubectl command, and a 'Fix applied successfully' confirmation" caption="One-click remediation, executed in-cluster and confirmed." />
      </section>

      {/* ---------------- Workloads ---------------- */}
      <section id="workloads">
        <h2 className="docs-h2">Dashboard · Workloads</h2>
        <p>Live deployment health across every namespace — ready/desired pods, restart counts, and a status badge (Healthy / Degraded / Down).</p>
        <Shot file="workloads.png" window="app.kubric.dev/dashboard" alt="Workloads table: Workload, Namespace, Pods, Restarts, Status columns" caption="Deployment health across all namespaces." />
        <h3 className="docs-h3">Nodes</h3>
        <p id="nodes">The Nodes screen shows node readiness, roles, and CPU/memory capacity and usage — useful for spotting pressure and unschedulable pods.</p>
        <Shot file="nodes.png" window="app.kubric.dev/dashboard" alt="Nodes screen: node name, status, roles, CPU% and memory% usage" caption="Node-level status and resource usage." />
      </section>

      {/* ---------------- Settings ---------------- */}
      <section id="settings">
        <h2 className="docs-h2">Dashboard · Settings</h2>
        <p>Manage connected clusters, add new ones (generate a token + copy the Helm command for your shell), set your trust mode and auto-fix boundaries, and invite teammates.</p>
        <Shot file="settings.png" window="app.kubric.dev/dashboard" alt="Settings → Clusters: connected clusters list and 'Add new cluster' with a generated token and shell-specific Helm command" caption="Settings — add clusters and generate install commands anytime." />
      </section>

      {/* ---------------- Architecture ---------------- */}
      <section id="architecture">
        <h2 className="docs-h2">How it works</h2>
        <p>Kubric is a push architecture with a closed detect → diagnose → fix loop:</p>
        <pre className="docs-code">{`Your cluster                          Kubric cloud
  kubric-agent  ──state (15s)──▶  /api/v1/state   ─▶ dashboard
      │         ──incident──────▶  /api/v1/ingest  ─▶ AI diagnosis
      │◀────── approved fix ─────  /api/v1/actions  ◀─ you approve
      └── executes fix (RBAC) ──▶  /actions/result  ─▶ resolved`}</pre>
        <ul>
          <li><strong>Detect:</strong> the agent watches every namespace and flags failing workloads.</li>
          <li><strong>Diagnose:</strong> Kubric investigates the evidence (and, in agent reasoning mode, calls read-only tools to follow the cause across resources) and produces a root cause.</li>
          <li><strong>Fix:</strong> on your approval, the in-cluster agent applies the remediation and reports back.</li>
        </ul>
      </section>

      {/* ---------------- Auto-fix ---------------- */}
      <section id="autofix">
        <h2 className="docs-h2">What Kubric can fix</h2>
        <p>Kubric can apply these remediations one-click:</p>
        <table className="docs-table">
          <thead><tr><th>Fix</th><th>Resolves</th></tr></thead>
          <tbody>
            <tr><td><strong>Update resource limits</strong></td><td>OOMKilled — raises memory/CPU limits (deterministic)</td></tr>
            <tr><td><strong>Update environment variable</strong></td><td>CrashLoop from a missing/wrong required env var (deterministic)</td></tr>
            <tr><td><strong>Rollback deployment</strong></td><td>A bad rollout, when a healthy previous revision exists</td></tr>
            <tr><td><strong>Restart pod</strong></td><td>A wedged/stuck pod that a clean restart clears</td></tr>
            <tr><td><strong>Scale deployment</strong></td><td>Over/under-provisioned replicas (e.g. unschedulable pods)</td></tr>
          </tbody>
        </table>
        <div className="docs-note">
          <div className="t">Detected but not auto-fixed</div>
          <p>Issues rooted in the container command or image content (e.g. an app that exits by design, or a missing image with no prior revision) are diagnosed with full evidence, but the fix requires a code/image change rather than an infrastructure action.</p>
        </div>
      </section>

      {/* ---------------- Security ---------------- */}
      <section id="security">
        <h2 className="docs-h2">Security</h2>
        <ul>
          <li><strong>Outbound-only:</strong> the agent initiates all connections; Kubric never reaches into your cluster.</li>
          <li><strong>Least-privilege RBAC:</strong> read access to cluster state, and only the specific verbs needed to apply an approved fix.</li>
          <li><strong>Read-only by default, fix on approval:</strong> nothing changes without your click (unless you opt into Auto-fix with boundaries).</li>
          <li><strong>Per-cluster tokens:</strong> a leaked token affects one cluster, not your whole fleet.</li>
        </ul>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq">
        <h2 className="docs-h2">Troubleshooting &amp; FAQ</h2>
        <h3 className="docs-h3">The agent pod is stuck in ImagePullBackOff</h3>
        <p>The agent image must be pullable by your cluster. Make sure the image is in a public registry (or configure an image pull secret). On minikube you can also sideload it with <span className="docs-inline">minikube image load &lt;image&gt;</span>.</p>
        <h3 className="docs-h3">CPU / memory show 0%</h3>
        <p>metrics-server isn’t serving data. Enable it (<span className="docs-inline">minikube addons enable metrics-server</span>) and confirm <span className="docs-inline">kubectl top nodes</span> returns numbers. Everything else works without it.</p>
        <h3 className="docs-h3">A deleted cluster still shows in the dashboard</h3>
        <p>The dashboard serves the last snapshot the agent pushed. Remove the agent and its stored state to clear it. Data goes stale when the agent stops reporting.</p>
        <h3 className="docs-h3">“helm: path not found”</h3>
        <p>Use the exact command from the dashboard — it installs the chart from a URL, so you don’t need the project checked out locally.</p>
        <div className="docs-note">
          <div className="t">Ready to try it?</div>
          <p>Open the dashboard, connect a cluster, and run your first scan. <Link href="/login" style={{ color: 'var(--accent)' }}>Open the dashboard →</Link></p>
        </div>
      </section>
    </>
  );
}
