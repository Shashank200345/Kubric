'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './docs.css';

/**
 * Screenshot / illustration slot.
 * Drop a real capture at /public/docs/<file> and it renders automatically;
 * until then it shows a labeled placeholder describing what to capture.
 */
function Shot({ file, src: srcProp, alt, caption, window: win }: { file?: string; src?: string; alt: string; caption?: string; window?: string }) {
  const [ok, setOk] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const src = srcProp || `/docs/${file}`;

  // lock body scroll + allow Esc to close while zoomed
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

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
          <img
            src={src}
            alt={alt}
            className="docs-shot-img"
            onClick={() => setZoomed(true)}
            onError={() => setOk(false)}
          />
        ) : (
          <>
            <span className="docs-shot-badge">screenshot</span>
            <span className="docs-shot-hint">{srcProp ? `public${srcProp}` : `public/docs/${file}`}</span>
            <span className="docs-shot-hint" style={{ opacity: 0.7 }}>{alt}</span>
          </>
        )}
      </div>
      {caption && <figcaption className="docs-shot-cap">{caption}</figcaption>}

      {zoomed && ok && (
        <div className="docs-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setZoomed(false)}>
          <button className="docs-lightbox-close" aria-label="Close" onClick={() => setZoomed(false)}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          {caption && <div className="docs-lightbox-cap">{caption}</div>}
        </div>
      )}
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
    group: 'Managed clusters',
    items: [
      { id: 'managed', label: 'EKS / GKE / AKS' },
      { id: 'managed-fargate', label: 'EKS Fargate (important)' },
      { id: 'managed-checklist', label: 'Pre-flight checklist' },
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
        <Shot src="/hero-dashboard.png" window="app.kubric.dev/dashboard" alt="Dashboard Overview: connected cluster, live metrics, incident count" caption="The Kubric dashboard once a cluster is connected." />
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
        <Shot src="/signup.png" window="app.kubric.dev/login" alt="Sign-up / login screen with brand panel on the left and form on the right" caption="Sign up or sign in to reach your workspace." />
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
        <div className="docs-shot-grid">
          <Shot file="onboarding-1.png" window="app.kubric.dev/dashboard" alt="Onboarding wizard — first step, with the progress tracker on the left" caption="Step 1 — getting started in the guided wizard." />
          <Shot file="onboarding-2.png" window="app.kubric.dev/dashboard" alt="Onboarding wizard — naming the cluster / choosing a connection method" caption="Step 2 — name your cluster and choose how to connect." />
          <Shot file="onboarding-3.png" window="app.kubric.dev/dashboard" alt="Onboarding wizard — connecting the cluster / selecting a trust mode" caption="Step 3 — connect the cluster and pick a trust mode." />
          <Shot file="onboarding-4.png" window="app.kubric.dev/dashboard" alt="Onboarding wizard — awaiting first scan / setup complete" caption="Step 4 — first data arrives and setup completes." />
        </div>
      </section>

      {/* ---------------- Connect a cluster ---------------- */}
      <section id="connect">
        <h2 className="docs-h2">Connect a cluster</h2>
        <p>On the Web Token step, Kubric generates a per-cluster token and a ready-to-run Helm command. Pick the tab that matches your terminal — the command is formatted for <strong>macOS/Linux</strong>, <strong>PowerShell</strong>, or <strong>Windows CMD</strong> so it pastes and runs cleanly.</p>
        <Shot file="onboarding-4.png" window="app.kubric.dev/dashboard" alt="Web Token step: token generated, shell tabs (macOS/Linux, PowerShell, Windows CMD), the Helm command, and a Copy button" caption="Generate a token and copy the Helm command for your shell." />
        <h3 className="docs-h3">Verify the agent is running</h3>
        <pre className="docs-code">{`kubectl -n kubric-system get pods
kubectl -n kubric-system logs -l app=kubric-agent --tail=20`}</pre>
        <p>You want the agent pod <span className="docs-inline">Running</span> and log lines like <span className="docs-inline">[agent] Pushed cluster state…</span>. Within ~30s the cluster populates in the dashboard.</p>
        <div className="docs-note warn">
          <div className="t">Two common gotchas</div>
          <p>1) The agent image must be pullable by your cluster (public registry). 2) For CPU/memory numbers, install metrics-server. Neither blocks incident detection or fixes.</p>
        </div>

        <h3 className="docs-h3">Using a managed cloud cluster (EKS / GKE / AKS)?</h3>
        <p>The agent runs on any conformant cluster — nothing is minikube-specific — but managed clusters have a few extra requirements (kubeconfig, metrics-server, node scheduling, and <strong>Fargate profiles on EKS</strong>). We&apos;ve put those in their own section so nothing bites you mid-install: see <a href="#managed">Managed clusters →</a>.</p>
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

      {/* ---------------- Managed clusters ---------------- */}
      <section id="managed">
        <h2 className="docs-h2">Managed Kubernetes (EKS / GKE / AKS)</h2>
        <p>
          The Kubric agent is a single lightweight pod, so it runs on <strong>any</strong> conformant
          cluster with no code changes. Managed cloud clusters just add a few environment concerns
          that a local minikube never has. Work through this section once and the install is a single
          Helm command — the same one shown in the wizard.
        </p>
        <div className="docs-note warn">
          <div className="t">Read this if your pod is stuck in <span className="docs-inline">Pending</span></div>
          <p>On managed clusters, <strong>99% of failed installs are scheduling problems, not Kubric problems</strong> — the agent image is fine, but the cluster has nowhere to place the pod. The two usual causes are <strong>EKS Fargate profiles</strong> and <strong>node pod-capacity limits</strong>, both covered below. Always start by reading the scheduler&apos;s own reason:</p>
          <pre className="docs-code">{`kubectl -n kubric-system describe pod -l app=kubric-agent
# scroll to Events: → look for the FailedScheduling message`}</pre>
        </div>

        <h3 className="docs-h3">1 · Point kubectl &amp; helm at the right cluster</h3>
        <pre className="docs-code">{`# EKS
aws eks update-kubeconfig --name <cluster-name> --region <region>

# GKE
gcloud container clusters get-credentials <cluster-name> --region <region>

# AKS
az aks get-credentials --resource-group <rg> --name <cluster-name>

# confirm you're on the intended cluster
kubectl config current-context
kubectl get nodes`}</pre>
        <p>Every command below acts on whatever <span className="docs-inline">current-context</span> points at — double-check it before installing so you don&apos;t connect the wrong cluster.</p>

        <h3 className="docs-h3">2 · Install metrics-server (for CPU / memory)</h3>
        <p>Managed clusters don&apos;t bundle metrics-server the way minikube does. Without it, CPU/memory read <span className="docs-inline">0</span> in the dashboard — incidents and fixes still work, but you lose the resource meters.</p>
        <pre className="docs-code">{`kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl top nodes   # should return numbers within a minute`}</pre>
        <p>EKS/GKE/AKS kubelet certificates are valid, so you normally do <strong>not</strong> need the <span className="docs-inline">--kubelet-insecure-tls</span> flag that local clusters sometimes require.</p>

        <h3 className="docs-h3">3 · Match the image to your node architecture</h3>
        <p>The default agent image is <strong>linux/amd64</strong>, which is correct for standard x86 node groups. On <strong>AWS Graviton / arm64</strong> nodes, either use an arm64 (or multi-arch) image, or schedule the agent onto an x86 node. An architecture mismatch shows up as <span className="docs-inline">exec format error</span> in the pod logs.</p>

        <h3 className="docs-h3">4 · Confirm outbound egress</h3>
        <p>The agent only makes <strong>outbound</strong> HTTPS calls, so no inbound firewall changes are needed — but the nodes must be able to reach the Kubric backend. That means a NAT gateway (for private subnets) or public subnets. Fully air-gapped clusters with no egress can&apos;t push data.</p>

        <h3 className="docs-h3">5 · Install the agent</h3>
        <p>Same cluster-agnostic command as the wizard / Settings:</p>
        <pre className="docs-code">{`helm install kubric-agent https://<your-backend>/install/kubric-agent-0.1.0.tgz \\
  -n kubric-system --create-namespace \\
  --set agent.token=<token> \\
  --set agent.clusterName=production-eks \\
  --set agent.ingestionEndpoint=https://<your-backend>/api/v1/ingest`}</pre>
        <div className="docs-note">
          <div className="t">Private registries (ECR / GAR / ACR)</div>
          <p>For production you can push the agent image to your own registry and set <span className="docs-inline">--set agent.image.repository=&lt;your-repo&gt;</span>. If the repo is private, add an image pull secret to the <span className="docs-inline">kubric-system</span> namespace so the pod can pull it.</p>
        </div>

        <h3 className="docs-h3">Full EKS walkthrough — every command, in order</h3>
        <p>Copy-paste this top to bottom on your local machine. Replace the <span className="docs-inline">&lt;placeholders&gt;</span>. Commands are grouped; the comments explain what each one is for.</p>
        <pre className="docs-code">{`# ── 0. Confirm your local tools are installed ─────────────────────────
aws --version           # AWS CLI v2
kubectl version --client
helm version

# ── 1. Authenticate to AWS (skip if already configured) ───────────────
aws configure            # enter Access Key, Secret, default region
aws sts get-caller-identity   # confirm you're the right IAM identity

# ── 2. Point kubectl at your EKS cluster ──────────────────────────────
aws eks list-clusters --region <region>            # find the name
aws eks update-kubeconfig --name <cluster-name> --region <region>
kubectl config current-context                     # sanity check
kubectl get nodes -o wide                          # nodes should be Ready

# ── 3. Detect Fargate BEFORE installing ───────────────────────────────
#   If any node name starts with "fargate-ip-", it's a Fargate cluster
#   → do section "EKS Fargate clusters" first, then come back to step 5.
kubectl get nodes -o wide

# ── 4. Install metrics-server (for CPU / memory in the dashboard) ─────
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system rollout status deployment metrics-server
kubectl top nodes        # should return numbers within ~1 min

# ── 5. Install the Kubric agent ───────────────────────────────────────
helm install kubric-agent https://<your-backend>/install/kubric-agent-0.1.0.tgz \\
  -n kubric-system --create-namespace \\
  --set agent.token=<token> \\
  --set agent.clusterName=production-eks \\
  --set agent.ingestionEndpoint=https://<your-backend>/api/v1/ingest

# ── 6. Watch it come up ───────────────────────────────────────────────
kubectl -n kubric-system get pods -w      # wait for Running (Ctrl+C to stop)
kubectl -n kubric-system logs -l app=kubric-agent --tail=30
#   You want log lines like: [agent] Pushed cluster state ... 200

# ── 7. Confirm in the dashboard ───────────────────────────────────────
#   The cluster appears within ~30s. Done.`}</pre>

        <div className="docs-note">
          <div className="t">About step 3 — Fargate check</div>
          <p>
            If <span className="docs-inline">kubectl get nodes</span> shows names starting with{' '}
            <span className="docs-inline">fargate-ip-</span>, complete{' '}
            <a href="#managed-fargate">EKS Fargate clusters →</a> first, then come back to step 5.
            Otherwise carry straight on.
          </p>
        </div>

        <div className="docs-note">
          <div className="t">If the pod is Pending</div>
          <p>Don&apos;t guess — read the scheduler&apos;s reason, then jump to the matching row in the <a href="#managed-checklist">pre-flight checklist</a>:</p>
          <pre className="docs-code">{`kubectl -n kubric-system describe pod -l app=kubric-agent
# scroll to Events: → the FailedScheduling line names the exact cause`}</pre>
        </div>

        <h3 className="docs-h3">Useful day-2 commands</h3>
        <pre className="docs-code">{`# Restart the agent (e.g. after adding a Fargate profile)
kubectl -n kubric-system rollout restart deployment kubric-agent

# Update to a newer chart / change a value
helm upgrade kubric-agent https://<your-backend>/install/kubric-agent-0.1.0.tgz \\
  -n kubric-system --reuse-values

# See what Helm has installed
helm -n kubric-system list

# Fully remove the agent
helm uninstall kubric-agent -n kubric-system
kubectl delete namespace kubric-system`}</pre>
        <div className="docs-note warn">
          <div className="t">Heads-up on <span className="docs-inline">--reuse-values</span></div>
          <p><span className="docs-inline">helm upgrade --reuse-values</span> keeps your old values but <strong>ignores new chart defaults</strong>. If an upgrade adds a new default you need, pass it explicitly with <span className="docs-inline">--set</span>, or drop <span className="docs-inline">--reuse-values</span> and re-supply your <span className="docs-inline">--set</span> flags.</p>
        </div>
        <p><strong>GKE / AKS:</strong> only step 2 changes — use <span className="docs-inline">gcloud container clusters get-credentials &lt;name&gt; --region &lt;region&gt;</span> or <span className="docs-inline">az aks get-credentials --resource-group &lt;rg&gt; --name &lt;name&gt;</span>. Steps 0 and 3–7 are identical, and neither GKE nor AKS has the Fargate step.</p>
      </section>

      {/* ---------------- EKS Fargate ---------------- */}
      <section id="managed-fargate">
        <h2 className="docs-h2">EKS Fargate clusters (important)</h2>
        <p>
          If your EKS cluster runs on <strong>Fargate</strong> — including &quot;Fargate-only&quot; clusters
          with no EC2 managed node group — the agent will sit in <span className="docs-inline">Pending</span> forever
          unless you do one extra step. This is the single most common reason a managed install
          &quot;doesn&apos;t work&quot;, so it gets its own section.
        </p>

        <h3 className="docs-h3">Why it happens</h3>
        <p>
          On Fargate, AWS provisions a right-sized micro-VM (a &quot;node&quot;) <strong>per pod</strong>, and it
          only does so for pods that match a <strong>Fargate profile</strong> (matched by namespace, and
          optionally labels). The Kubric agent installs into the <span className="docs-inline">kubric-system</span> namespace.
          If no Fargate profile selects that namespace, AWS never creates a node for the pod, and it
          stays unschedulable. You&apos;ll see this in the events:
        </p>
        <pre className="docs-code">{`# Every node is fargate-ip-... with Capacity: pods: 1, and:
Warning  FailedScheduling  ...  0/N nodes are available: N Too many pods.`}</pre>
        <p>Two tells confirm it&apos;s Fargate: node names start with <span className="docs-inline">fargate-ip-</span>, and each node reports <span className="docs-inline">Capacity: pods: 1</span> (a Fargate node hosts exactly one pod).</p>

        <h3 className="docs-h3">The fix — create a Fargate profile for the namespace</h3>
        <p>Reuse the pod-execution role and subnets from a profile you already have:</p>
        <pre className="docs-code">{`# 1. See existing profiles
aws eks list-fargate-profiles --cluster-name <cluster-name>

# 2. Grab the podExecutionRoleArn + subnets from one of them
aws eks describe-fargate-profile --cluster-name <cluster-name> \\
  --fargate-profile-name <existing-profile-name>

# 3. Create a profile that selects the kubric-system namespace
aws eks create-fargate-profile \\
  --cluster-name <cluster-name> \\
  --fargate-profile-name kubric-system \\
  --pod-execution-role-arn <podExecutionRoleArn-from-step-2> \\
  --subnets <subnet-1> <subnet-2> \\
  --selectors namespace=kubric-system`}</pre>
        <p>Prefer the console? <strong>EKS → your cluster → Compute → Fargate profiles → Add Fargate profile</strong>. Name it <span className="docs-inline">kubric-system</span>, pick the existing pod-execution role and private subnets, and add a selector with <strong>Namespace = <span className="docs-inline">kubric-system</span></strong> (leave labels blank).</p>
        <p>Profile creation takes ~1–2 minutes. Once it&apos;s <span className="docs-inline">ACTIVE</span>, restart the deployment so the pod re-schedules onto a freshly provisioned Fargate node:</p>
        <pre className="docs-code">{`kubectl -n kubric-system rollout restart deployment kubric-agent
kubectl -n kubric-system get pods -w   # Pending → Running in ~60–90s`}</pre>
        <div className="docs-note">
          <div className="t">Order tip</div>
          <p>Cleanest sequence: create the <span className="docs-inline">kubric-system</span> Fargate profile <em>first</em>, then run <span className="docs-inline">helm install</span>. If you already installed and it&apos;s Pending, just add the profile and <span className="docs-inline">rollout restart</span> — no reinstall needed.</p>
        </div>
        <div className="docs-note warn">
          <div className="t">Fargate sizing &amp; cold start</div>
          <p>Fargate rounds every pod up to a minimum of <strong>0.25 vCPU / 0.5 GB</strong>, so the agent&apos;s tiny requests still bill at that floor. Expect a <strong>~60–90s cold start</strong> per Fargate pod versus seconds on EC2. Neither affects functionality.</p>
        </div>
      </section>

      {/* ---------------- Pre-flight checklist ---------------- */}
      <section id="managed-checklist">
        <h2 className="docs-h2">Managed cluster pre-flight checklist</h2>
        <p>Run through this before <span className="docs-inline">helm install</span> and the agent should come up <span className="docs-inline">Running</span> on the first try:</p>
        <table className="docs-table">
          <thead><tr><th>Check</th><th>Command / action</th></tr></thead>
          <tbody>
            <tr><td>Right cluster selected</td><td><span className="docs-inline">kubectl config current-context</span></td></tr>
            <tr><td>Nodes are Ready</td><td><span className="docs-inline">kubectl get nodes</span></td></tr>
            <tr><td>Is it Fargate?</td><td>Node names start with <span className="docs-inline">fargate-ip-</span> → create a <span className="docs-inline">kubric-system</span> Fargate profile <em>first</em></td></tr>
            <tr><td>Room to schedule (EC2 nodes)</td><td><span className="docs-inline">kubectl describe nodes</span> → a node with free pod capacity; if all show &quot;Too many pods&quot;, add a node</td></tr>
            <tr><td>metrics-server installed</td><td><span className="docs-inline">kubectl top nodes</span> returns numbers</td></tr>
            <tr><td>Node architecture</td><td>amd64 image on x86 nodes; arm64/multi-arch on Graviton</td></tr>
            <tr><td>Outbound HTTPS egress</td><td>NAT gateway or public subnets can reach the backend</td></tr>
          </tbody>
        </table>
        <h3 className="docs-h3">Still Pending? Read the scheduler, don&apos;t guess</h3>
        <p>The events section names the exact cause. Common ones on managed clusters:</p>
        <table className="docs-table">
          <thead><tr><th>Message</th><th>Cause &amp; fix</th></tr></thead>
          <tbody>
            <tr><td><span className="docs-inline">Too many pods</span> (nodes are <span className="docs-inline">fargate-ip-</span>)</td><td>Fargate-only cluster, no profile for the namespace → create a <span className="docs-inline">kubric-system</span> Fargate profile.</td></tr>
            <tr><td><span className="docs-inline">Too many pods</span> (EC2 nodes, all full)</td><td>Every node hit its max-pods-per-node cap → add a node to the group, or free a slot.</td></tr>
            <tr><td><span className="docs-inline">Insufficient cpu / memory</span></td><td>Nodes are out of allocatable resources → scale the node group up.</td></tr>
            <tr><td><span className="docs-inline">had untolerated taint</span></td><td>Nodes are tainted → the chart tolerates any taint by default; ensure you&apos;re on the current chart, or add a matching toleration.</td></tr>
            <tr><td><span className="docs-inline">didn&apos;t match node affinity/selector</span></td><td>A nodeSelector/affinity mismatch → clear or correct the selector.</td></tr>
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

        <h3 className="docs-h3">Adding another cluster</h3>
        <p>
          You&apos;re not limited to the cluster you connected during onboarding — you can add more at
          any time from <strong>Settings → Clusters</strong>. The flow is the same as the wizard:
          name the cluster, generate a token, then run the Helm command against it.
        </p>
        <ol className="docs-steps">
          <li>
            <h4>Open Settings → Clusters and start a new cluster</h4>
            <p>Enter a name for the cluster you want to connect (lowercase letters, numbers, and hyphens).</p>
          </li>
          <li>
            <h4>Generate the token and copy the command</h4>
            <p>Kubric issues a per-cluster token and builds the install command. Pick the tab matching your terminal (macOS/Linux, PowerShell, or Windows CMD), copy it, and run it against the target cluster.</p>
          </li>
        </ol>
        <div className="docs-shot-grid">
          <Shot file="settings-add-cluster-1.png" window="app.kubric.dev/dashboard" alt="Settings → Clusters: adding a new cluster and entering its name" caption="Step 1 — add a cluster and give it a name." />
          <Shot file="settings-add-cluster-2.png" window="app.kubric.dev/dashboard" alt="Settings → Clusters: generated cluster token with the shell-specific Helm install command and copy button" caption="Step 2 — generate the token and copy the Helm command." />
        </div>
        <div className="docs-note">
          <div className="t">One token per cluster</div>
          <p>Each cluster gets its own token, so a leaked token only affects that one cluster. Reuse of a token across clusters isn&apos;t supported — generate a fresh one for each. Removing an agent later is a single <a href="#faq">helm uninstall →</a>.</p>
        </div>
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
        <h3 className="docs-h3">The agent pod is stuck in Pending on EKS</h3>
        <p>Almost always a scheduling issue, not a Kubric issue. If your nodes are named <span className="docs-inline">fargate-ip-…</span>, it&apos;s a Fargate-only cluster and you need a Fargate profile for the <span className="docs-inline">kubric-system</span> namespace — see <a href="#managed-fargate">EKS Fargate clusters</a>. If they&apos;re EC2 nodes reporting &quot;Too many pods&quot;, they&apos;ve hit their pod-capacity cap — add a node. Always check <span className="docs-inline">kubectl -n kubric-system describe pod -l app=kubric-agent</span> first.</p>
        <h3 className="docs-h3">“helm: path not found”</h3>
        <p>Use the exact command from the dashboard — it installs the chart from a URL, so you don’t need the project checked out locally.</p>
        <h3 className="docs-h3">How do I remove the agent from my cluster?</h3>
        <p>The agent is a standard Helm release, so uninstalling is one command. This works on any cluster (minikube, EKS, GKE, AKS):</p>
        <pre className="docs-code">{`# Remove the agent (deployment, service account, RBAC, secret)
helm uninstall kubric-agent -n kubric-system

# Optional: delete the namespace too, for a completely clean removal
kubectl delete namespace kubric-system`}</pre>
        <p>That&apos;s it — the agent stops pushing data immediately and nothing remains running in your cluster. On managed clusters, if you created a dedicated Fargate profile for <span className="docs-inline">kubric-system</span>, you can delete that too (<span className="docs-inline">aws eks delete-fargate-profile</span>).</p>
        <div className="docs-note">
          <div className="t">Clearing the cluster from the dashboard</div>
          <p>The dashboard shows the last snapshot the agent pushed, so a removed cluster may linger until its data goes stale. Remove it from <strong>Settings → Clusters</strong> to clear it from your workspace.</p>
        </div>
        <div className="docs-note">
          <div className="t">Ready to try it?</div>
          <p>Open the dashboard, connect a cluster, and run your first scan. <Link href="/login" style={{ color: 'var(--accent)' }}>Open the dashboard →</Link></p>
        </div>
      </section>
    </>
  );
}
