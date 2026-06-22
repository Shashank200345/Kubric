"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import "./landing.css";

export default function LandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Incident response");

  const tabs = [
    "Incident response",
    "Cost optimization",
    "Upgrade planning",
    "Policy & compliance",
    "Capacity forecasting",
  ];

  return (
    <div className="landing">
      {/* NAV */}
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#">
            <span className="brand-mark"></span>
            <span className="brand-name">kubric</span>
          </a>
          <nav className="nav-links">
            <a href="#product">Product</a>
            <a href="#solutions">Solutions</a>
            <a href="#infra">Infrastructure</a>
            <a href="#docs">Docs</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="nav-cta">
            <a
              className="link-muted"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.push("/login");
              }}
            >
              Sign in
            </a>
            <a
              className="btn btn-primary"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.push("/login");
              }}
            >
              Get started →
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <video className="hero-video-bg" src="/hero-background.mp4" autoPlay loop muted playsInline />
        <div className="container hero-inner">
          <div className="eyebrow">
            <span className="dot"></span> Now in public beta — free for clusters
            under 10 nodes
          </div>
          <h1 className="display">
            Kubernetes troubleshooting,
            <br />
            <span className="grad">solved by AI.</span>
          </h1>
          <p className="lede">
            Kubric is an autonomous SRE agent that diagnoses cluster failures,
            pinpoints root causes, and ships fixes — in seconds, not stand‑ups.
            Plug it into any cluster and stop firefighting at 3 AM.
          </p>
          <div className="hero-cta">
            <a
              className="btn btn-primary lg"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.push("/login");
              }}
            >
              Start free →
            </a>
            <a className="btn btn-ghost lg" href="#">
              Book a demo
            </a>
          </div>
          <div className="hero-trust">
            Trusted by platform teams at fast‑moving companies
            <div className="logos">
              <span>Northwind</span>
              <span>Helios</span>
              <span>Acme&nbsp;Cloud</span>
              <span>Lumen</span>
              <span>Forge.io</span>
              <span>Quanta</span>
            </div>
          </div>
        </div>

        {/* Terminal mock */}
        <div className="container">
          <div className="terminal">
            <div className="terminal-bar">
              <span className="tdot r"></span>
              <span className="tdot y"></span>
              <span className="tdot g"></span>
              <span className="tname">
                kubric • incident #4821 • prod-us-east
              </span>
            </div>
            <pre className="terminal-body">
              <span className="c-mut">$</span>{" "}
              <span className="c-cmd">kubric diagnose</span> --ns payments
              --since 5m{"\n"}
              <span className="c-mut">
                → scanning 312 pods · 4 nodes · 17 services …
              </span>
              {"\n\n"}
              <span className="c-ok">✓ root cause identified</span>{" "}
              <span className="c-mut">(confidence 0.94)</span>
              {"\n"}
              <span className="c-key">pod</span>
              {"      "}checkout-api-7df9c-xk2lq{"\n"}
              <span className="c-key">status</span>
              {"   "}CrashLoopBackOff × 23{"\n"}
              <span className="c-key">cause</span>
              {"    "}OOMKilled — memory limit 512Mi exceeded{"\n"}
              {"            "}after deploy{" "}
              <span className="c-warn">v1.42.0</span> (+38% heap usage)
              {"\n\n"}
              <span className="c-key">fix</span>
              {"      "}bump resources.limits.memory → 768Mi{"\n"}
              {"         "}and revert PR #2814 (leak in JsonCodec.flush)
              {"\n\n"}
              <span className="c-mut">apply now?</span>{" "}
              <span className="c-cmd">[y/N]</span>{" "}
              <span className="cursor">▍</span>
            </pre>
          </div>
        </div>
      </section>

      {/* CAPABILITY GRID */}
      <section className="section" id="product">
        <div className="container">
          <h2 className="section-title">
            The autonomous platform for cluster reliability.
          </h2>
          <div className="cap-grid">
            <article className="cap">
              <div className="cap-tag">Kubric Agent</div>
              <h3>Your SRE, in code.</h3>
              <p>
                Connect your cluster with a single Helm command. Kubric reads
                events, logs, metrics, and traces — and reasons across them like
                a senior engineer.
              </p>
            </article>
            <article className="cap">
              <div className="cap-tag">AI‑native runtime</div>
              <h3>Built for speed, at incident scale.</h3>
              <p>
                Sub‑second triage across thousands of pods. Parallel inference
                over your telemetry, with answers grounded in your actual cluster
                state.
              </p>
            </article>
            <article className="cap">
              <div className="cap-tag">Elastic coverage</div>
              <h3>From one cluster to one thousand.</h3>
              <p>
                Multi‑cluster, multi‑cloud, multi‑region. Kubric routes
                investigations across fleets in real time — no agents to
                babysit, no quotas to plan.
              </p>
            </article>
            <article className="cap">
              <div className="cap-tag">Production ready</div>
              <h3>Observability you can trust.</h3>
              <p>
                Every diagnosis is auditable, with full timelines, evidence, and
                the queries Kubric ran. SOC 2 Type II, read‑only by default,
                fix‑on‑approval.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* WORKLOADS */}
      <section className="section dim" id="solutions">
        <div className="container">
          <div className="kicker">Workloads</div>
          <h2 className="section-title">Resolve any failure mode.</h2>
          <div className="wl-grid">
            <div className="wl">
              <h4>CrashLoops &amp; OOMs</h4>
              <p>
                Identify the offending deploy, the failing container, and the
                resource ceiling — with a one‑click patch.
              </p>
            </div>
            <div className="wl">
              <h4>Networking &amp; DNS</h4>
              <p>
                Trace 5xx waterfalls across services, CNI, CoreDNS, and ingress.
                Kubric explains the hop that broke.
              </p>
            </div>
            <div className="wl">
              <h4>Scheduling &amp; capacity</h4>
              <p>
                Pending pods, noisy neighbors, taints, affinity — Kubric finds
                the constraint and suggests a placement fix.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SECTION 1 */}
      <section className="section">
        <div className="container split">
          <div className="split-copy">
            <h2 className="section-title left">Engineered for incidents.</h2>
            <p className="muted">
              From the moment a pod flips red, every layer of Kubric —
              collectors, retrieval, reasoning, action — is tuned for the way
              real incidents actually unfold.
            </p>
            <a className="link-arrow" href="#">
              Learn more →
            </a>
          </div>
          <div className="split-grid">
            <div className="mini">
              <h5>Live diagnosis</h5>
              <p>
                Streaming RCA the moment alerts fire — no ticket triage in
                between.
              </p>
            </div>
            <div className="mini">
              <h5>Evidence first</h5>
              <p>
                Every claim is backed by the log line, metric, or event that
                supports it.
              </p>
            </div>
            <div className="mini">
              <h5>Safe actions</h5>
              <p>
                Dry‑run by default. Kubric proposes; humans (or your policy)
                approve.
              </p>
            </div>
            <div className="mini">
              <h5>Runbooks that learn</h5>
              <p>
                Past incidents become institutional memory — Kubric remembers
                your cluster.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SECTION 2 */}
      <section className="section">
        <div className="container split reverse">
          <div className="split-copy">
            <h2 className="section-title left">
              Designed for platform teams.
            </h2>
            <p className="muted">
              Whether you operate a single GKE cluster or a fleet of EKS
              regions, Kubric slots into your existing stack — Prometheus, Loki,
              Datadog, OpenTelemetry, Argo, Flux — without rip‑and‑replace.
            </p>
            <a className="link-arrow" href="#">
              Learn more →
            </a>
          </div>
          <div className="split-grid">
            <div className="mini">
              <h5>Multi‑cluster</h5>
              <p>
                One control plane, every cluster. Drill from fleet view to pod
                logs in two clicks.
              </p>
            </div>
            <div className="mini">
              <h5>GitOps native</h5>
              <p>
                Fixes ship as PRs to your manifests — reviewed, merged, rolled
                out.
              </p>
            </div>
            <div className="mini">
              <h5>Policy guardrails</h5>
              <p>
                Define what Kubric can touch. Namespaces, verbs, blast radius —
                all configurable.
              </p>
            </div>
            <div className="mini">
              <h5>BYO models</h5>
              <p>
                Use Kubric‑hosted models, your own OpenAI/Anthropic keys, or
                self‑hosted Llama.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE STRIPES */}
      <section className="stripes" id="infra">
        <div className="stripe-title">Global cluster intelligence</div>
        <div className="marquee">
          <div className="marquee-track">
            <span>Any cluster, any cloud</span>
            <span>·</span>
            <span>EKS · GKE · AKS · OpenShift</span>
            <span>·</span>
            <span>Multi‑region by default</span>
            <span>·</span>
            <span>Streaming RCA</span>
            <span>·</span>
            <span>Read‑only safe</span>
            <span>·</span>
            <span>Any cluster, any cloud</span>
            <span>·</span>
            <span>EKS · GKE · AKS · OpenShift</span>
            <span>·</span>
            <span>Multi‑region by default</span>
            <span>·</span>
            <span>Streaming RCA</span>
            <span>·</span>
            <span>Read‑only safe</span>
            <span>·</span>
          </div>
        </div>

        <div className="stripe-title">Security &amp; governance</div>
        <div className="marquee reverse">
          <div className="marquee-track">
            <span>SOC 2 Type II</span>
            <span>·</span>
            <span>RBAC‑aware</span>
            <span>·</span>
            <span>In‑VPC deployment</span>
            <span>·</span>
            <span>Audit log everything</span>
            <span>·</span>
            <span>Customer‑managed keys</span>
            <span>·</span>
            <span>SOC 2 Type II</span>
            <span>·</span>
            <span>RBAC‑aware</span>
            <span>·</span>
            <span>In‑VPC deployment</span>
            <span>·</span>
            <span>Audit log everything</span>
            <span>·</span>
            <span>Customer‑managed keys</span>
            <span>·</span>
          </div>
        </div>
      </section>

      {/* CUSTOMERS / RESULTS */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">
            Helping platform teams sleep at night.
          </h2>
          <div className="case-grid">
            <a className="case big" href="#">
              <div className="case-logo">▲ Northwind</div>
              <div className="case-stat">73%</div>
              <div className="case-label">
                drop in MTTR for production incidents
              </div>
            </a>
            <a className="case" href="#">
              <div className="case-logo">Helios</div>
              <p>
                Cut on‑call paging volume in half across 14 EKS clusters.
              </p>
            </a>
            <a className="case" href="#">
              <div className="case-logo">Forge.io</div>
              <p>
                &ldquo;Kubric resolves the boring 80% before a human even
                looks.&rdquo;
              </p>
            </a>
            <a className="case" href="#">
              <div className="case-logo">Quanta</div>
              <div className="case-stat sm">9 min → 42 sec</div>
              <div className="case-label">
                average time‑to‑root‑cause
              </div>
            </a>
            <a className="case" href="#">
              <div className="case-logo">Lumen</div>
              <p>Replaced a 400‑page runbook with a single agent.</p>
            </a>
          </div>
        </div>
      </section>

      {/* EXAMPLES */}
      <section className="section dim">
        <div className="container">
          <h2 className="section-title">Built with Kubric</h2>
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="ex-grid">
            <a className="ex" href="#">
              <h5>Auto‑diagnose 5xx spikes</h5>
              <p>
                Correlate ingress, service mesh, and pod errors into one
                timeline.
              </p>
            </a>
            <a className="ex" href="#">
              <h5>Resolve CrashLoopBackOff</h5>
              <p>
                From event noise to root cause and a ready‑to‑merge patch PR.
              </p>
            </a>
            <a className="ex" href="#">
              <h5>Find the noisy neighbor</h5>
              <p>
                Spot the workload starving everyone else on the node —
                automatically.
              </p>
            </a>
            <a className="ex" href="#">
              <h5>Tame OOMKills</h5>
              <p>
                Right‑size memory limits with evidence from real traffic.
              </p>
            </a>
            <a className="ex" href="#">
              <h5>Debug DNS storms</h5>
              <p>
                Trace CoreDNS latency back to the chatty client that triggered
                it.
              </p>
            </a>
            <a className="ex" href="#">
              <h5>Upgrade readiness</h5>
              <p>
                Surface deprecated APIs and breaking changes before you cut
                over.
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="container cta-inner">
          <h2>Ship your cluster&apos;s first fix in minutes.</h2>
          <a
            className="btn btn-primary lg"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              router.push("/login");
            }}
          >
            Get started →
          </a>
          <div className="cta-note">
            Free on clusters under 10 nodes. No credit card required.
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container foot-grid">
          <div>
            <div className="brand">
              <span className="brand-mark"></span>
              <span className="brand-name">kubric</span>
            </div>
            <p className="muted small">The autonomous SRE for Kubernetes.</p>
          </div>
          <div>
            <h6>Product</h6>
            <a href="#">Agent</a>
            <a href="#">Integrations</a>
            <a href="#">Pricing</a>
            <a href="#">Changelog</a>
          </div>
          <div>
            <h6>Resources</h6>
            <a href="#">Docs</a>
            <a href="#">Blog</a>
            <a href="#">Examples</a>
            <a href="#">Status</a>
          </div>
          <div>
            <h6>Company</h6>
            <a href="#">About</a>
            <a href="#">Careers</a>
            <a href="#">Security</a>
            <a href="#">Contact</a>
          </div>
        </div>
        <div className="container foot-bottom">
          <span>© 2026 Kubric Labs, Inc.</span>
          <span>Made for platform teams.</span>
        </div>
      </footer>
    </div>
  );
}
