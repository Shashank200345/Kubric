"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import "./landing.css";
import { Header } from "@/components/ui/header-2";
import ArchitectureFlow from "@/components/ArchitectureFlow";
import InteractiveTerminal from "@/components/InteractiveTerminal";
import EcosystemFlow from "@/components/EcosystemFlow";
import ResolutionShowcase from "@/components/ResolutionShowcase";

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
      <Header />

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
            <button
              className="btn btn-primary lg"
              onClick={(e) => {
                e.preventDefault();
                router.push("/login");
              }}
            >
              Start free <span className="arrow">→</span>
            </button>
            <button
              className="btn-text"
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              See how it works <span className="arrow">→</span>
            </button>
          </div>

        </div>

        {/* Terminal mock — interactive */}
        <div className="container">
          <InteractiveTerminal />
        </div>
      </section>

      {/* HOW IT WORKS — interactive investigation flow */}
      <section className="section" id="how-it-works">
        <div className="container">
          <ArchitectureFlow />
        </div>
      </section>

      {/* ECOSYSTEM — plugs into your stack */}
      <section className="section dim" id="ecosystem">
        <div className="container">
          <div className="kicker" style={{ textAlign: 'center' }}>Connected</div>
          <h2 className="section-title" style={{ textAlign: 'center', marginLeft: 'auto', marginRight: 'auto', marginBottom: '18px' }}>Plugs into your <em style={{ fontStyle: 'italic', color: '#7cffb2' }}>entire cluster stack.</em></h2>
          <p className="muted" style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto 50px', fontSize: '16px' }}>
            One agent, every layer of your platform — orchestration, packaging, and observability, working together.
          </p>
          <EcosystemFlow />
        </div>
      </section>

      {/* CAPABILITY LIST — pods.ml-style layout */}
      <section className="section" id="product">
        <div className="container">
          <div className="pods-head">
            <span className="pods-head-label"><span className="sq" /> The platform</span>
            <span className="pods-head-line" />
            <span className="pods-head-count">4 pillars</span>
          </div>
          <h2 className="pods-title">
            The autonomous platform. <em>Built to scale.</em>
          </h2>
          <div className="pods-list">
            {[
              {
                idx: "01",
                name: "Your SRE, in code",
                cat: "Agent",
                desc: "Connect your cluster with a single Helm command — Kubric reasons across events, logs, metrics, and traces like a senior engineer.",
                cmd: "$ kubric connect --cluster prod",
                fields: [
                  { k: "Setup", v: "1 Helm cmd" },
                  { k: "Signals", v: "logs · metrics" },
                  { k: "Mode", v: "Autonomous" },
                  { k: "Latency", v: "Real-time" },
                  { k: "Scope", v: "Cluster-wide" },
                ],
                note: "Reads events, logs, metrics, and traces — and reasons across them to find the real cause, not just the symptom.",
                deploy: "Deploy the agent",
              },
              {
                idx: "02",
                name: "Built for incident scale",
                cat: "Runtime",
                desc: "Sub-second triage across thousands of pods, with parallel inference grounded in your actual cluster state.",
                cmd: "$ kubric triage --ns payments",
                fields: [
                  { k: "Triage", v: "Sub-second" },
                  { k: "Inference", v: "Parallel" },
                  { k: "Throughput", v: "1000s pods" },
                  { k: "Grounding", v: "Live state" },
                  { k: "Models", v: "Ensemble" },
                ],
                note: "Parallel inference over your telemetry, with answers grounded in the real state of the cluster — never a hallucinated guess.",
                deploy: "See it run",
              },
              {
                idx: "03",
                name: "From one to one thousand",
                cat: "Coverage",
                desc: "Multi-cluster, multi-cloud, multi-region — Kubric routes investigations across fleets in real time.",
                cmd: "$ kubric fleet add eks-us-east",
                fields: [
                  { k: "Clusters", v: "Unlimited" },
                  { k: "Clouds", v: "Any" },
                  { k: "Regions", v: "Global" },
                  { k: "Agents", v: "Zero" },
                  { k: "Routing", v: "Real-time" },
                ],
                note: "No agents to babysit, no quotas to plan. One control plane spans every cluster across every cloud and region.",
                deploy: "Connect a fleet",
              },
              {
                idx: "04",
                name: "Observability you can trust",
                cat: "Trust",
                desc: "Every diagnosis is auditable — full timelines, evidence, and the exact queries Kubric ran.",
                cmd: "$ kubric audit incident-4821",
                fields: [
                  { k: "Audit", v: "Full trail" },
                  { k: "Compliance", v: "SOC 2" },
                  { k: "Access", v: "Read-only" },
                  { k: "Fixes", v: "On approval" },
                  { k: "Evidence", v: "Linked" },
                ],
                note: "SOC 2 Type II, read-only by default, fix-on-approval. Every claim links back to the log line or metric behind it.",
                deploy: "Review the trail",
              },
            ].map((row) => (
              <div className="pod-row" key={row.idx}>
                <div className="pod-row-head">
                  <div className="pod-idx">
                    {row.idx} <span className="dot" />
                  </div>
                  <div className="pod-main">
                    <h3 className="pod-name">
                      {row.name} <span className="pod-cat">{row.cat}</span>
                    </h3>
                    <p className="pod-desc">{row.desc}</p>
                  </div>
                </div>
                <div className="pod-detail">
                  <div className="pod-detail-inner">
                    <div className="pod-detail-grid">
                      <div className="pod-hero">
                        <div className="pod-hero-top">
                          <span className="pod-hero-tag">{row.cat}</span>
                          <span className="pod-live">
                            <span className="pod-live-dot" /> Live
                          </span>
                        </div>
                        <div className="pod-hero-title">{row.name}</div>
                        <div className="pod-hero-cmd">{row.cmd}</div>
                      </div>
                      <div className="pod-detail-right">
                        <p className="pod-detail-lead">{row.desc}</p>
                        <div className="pod-detail-meta">
                          {row.fields.map((f) => (
                            <div className="pod-field" key={f.k}>
                              <span className="k">{f.k}</span>
                              <span className="v">{f.v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pod-detail-foot">
                          <p className="pod-detail-note">{row.note}</p>
                          <a
                            className="pod-cta"
                            href="#"
                            onClick={(e) => e.preventDefault()}
                          >
                            {row.deploy} <span className="arrow">→</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKLOADS — pods.ml step-card layout */}
      <section className="section dim" id="solutions">
        <div className="container">
          <div className="pods-head">
            <span className="pods-head-label"><span className="sq" /> Workloads</span>
            <span className="pods-head-line" />
            <span className="pods-head-count">3 modes</span>
          </div>
          <h2 className="pods-title">
            Resolve any <em>failure mode.</em>
          </h2>
          <div className="steps-grid">
            {[
              {
                idx: "01",
                label: "Memory & restarts",
                desc: "Identify the offending deploy, the failing container, and the resource ceiling — with a one-click patch.",
                meta: [
                  { k: "Signal", v: "OOMKilled · CrashLoop" },
                  { k: "Detects", v: "Memory ceiling" },
                  { k: "Fix", v: "One-click patch" },
                ],
                cmd: "$ kubric diagnose --oom",
              },
              {
                idx: "02",
                label: "Connectivity",
                desc: "Trace 5xx waterfalls across services, CNI, CoreDNS, and ingress. Kubric explains the exact hop that broke.",
                meta: [
                  { k: "Signal", v: "5xx · DNS timeouts" },
                  { k: "Traces", v: "CNI · CoreDNS · ingress" },
                  { k: "Fix", v: "Pinpoints the hop" },
                ],
                cmd: "$ kubric trace --svc checkout",
              },
              {
                idx: "03",
                label: "Placement",
                desc: "Pending pods, noisy neighbors, taints, affinity — Kubric finds the constraint and suggests a placement fix.",
                meta: [
                  { k: "Signal", v: "Pending pods" },
                  { k: "Detects", v: "Taints · affinity · quota" },
                  { k: "Fix", v: "Placement suggestion" },
                ],
                cmd: "$ kubric why-pending",
                accent: true,
              },
            ].map((step) => (
              <div className="step-card" key={step.idx}>
                <div className="step-top">
                  <span className={`step-num ${step.accent ? "accent" : ""}`}>
                    {step.idx}
                  </span>
                  <span className="step-label">{step.label}</span>
                </div>
                <p className="step-desc">{step.desc}</p>
                <div className="step-meta">
                  {step.meta.map((m) => (
                    <div className="step-row" key={m.k}>
                      <span className="k">{m.k}</span>
                      <span className="v">{m.v}</span>
                    </div>
                  ))}
                </div>
                <div className="step-cmd">
                  <span className="dollar">$</span>
                  {step.cmd.replace(/^\$\s*/, "")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE — animated incident terminals */}
      <section className="section" id="showcase">
        <div className="container">
          <div className="pods-head">
            <span className="pods-head-label"><span className="sq" /> In action</span>
            <span className="pods-head-line" />
            <span className="pods-head-count">live</span>
          </div>
          <h2 className="pods-title">
            Watch Kubric <em>resolve real incidents.</em>
          </h2>
          <ResolutionShowcase />
        </div>
      </section>

      {/* PRODUCT SECTION 1 */}
      <section className="section">
        <div className="container split">
          <div className="split-copy">
            <h2 className="section-title left">Engineered for <em style={{ fontStyle: 'italic', color: '#7cffb2' }}>incidents.</em></h2>
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
              Designed for <em style={{ fontStyle: 'italic', color: '#7cffb2' }}>platform teams.</em>
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
            Helping platform teams <em style={{ fontStyle: 'italic', color: '#7cffb2' }}>sleep at night.</em>
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
          <h2 className="section-title">Built with <em style={{ fontStyle: 'italic', color: '#7cffb2' }}>Kubric</em></h2>
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

      {/* CTA — video left, content right (dark blend) */}
      <section className="cta-video">
        <div className="container cta-grid">
          <div className="cta-video-wrap">
            <video
              className="cta-video-el"
              src="/kubric-logo.mp4"
              autoPlay
              loop
              muted
              playsInline
            />
            <span className="cta-video-mask" />
          </div>
          <div className="cta-copy">
            <h2>Ship your cluster&apos;s first fix <em>in minutes.</em></h2>
            <a
              className="btn btn-primary lg"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.push("/login");
              }}
            >
              Get started <span className="arrow">→</span>
            </a>
            <div className="cta-note">
              Free on clusters under 10 nodes. No credit card required.
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container foot-grid">
          <div>
            <div className="brand">
              <img src="/kubric-logo.png" alt="Kubric" style={{ height: '200px', width: 'auto' }} />
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
