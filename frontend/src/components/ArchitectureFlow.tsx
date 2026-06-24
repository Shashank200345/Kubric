'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    icon: 'ti-radar-2',
    title: 'Detect failures',
    desc: 'Kubric watches every namespace and instantly flags workloads that crash, OOM, or fail to pull an image.',
  },
  {
    icon: 'ti-checklist',
    title: 'Gather evidence',
    desc: 'Four specialized inspectors pull pod state, logs, warning events, and network reachability — all in parallel.',
  },
  {
    icon: 'ti-brain',
    title: 'Reason about root cause',
    desc: 'The model correlates the full evidence bundle to pinpoint why each workload broke, not just what failed.',
  },
  {
    icon: 'ti-tool',
    title: 'Ship the fix',
    desc: 'You get ready-to-run kubectl commands and a plain-English diagnosis — applied on your terms.',
  },
];

export default function ArchitectureFlow() {
  const [activeBeams, setActiveBeams] = useState<Set<string>>(new Set());
  const [firingPods, setFiringPods] = useState<Set<number>>(new Set());
  const [activeInspectors, setActiveInspectors] = useState<Set<number>>(new Set());
  const [progressFills, setProgressFills] = useState<number[]>([0, 0, 0, 0]);
  const [activeReasoningLines, setActiveReasoningLines] = useState<Set<number>>(new Set());
  const [mergeDotVisible, setMergeDotVisible] = useState(false);
  const [brainStatus, setBrainStatus] = useState<'waiting' | 'reasoning' | 'done'>('waiting');
  const [fixVisible, setFixVisible] = useState(false);
  const [diagVisible, setDiagVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function T(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function addBeam(id: string) {
    setActiveBeams(prev => new Set(prev).add(id));
  }

  function reset() {
    setActiveBeams(new Set());
    setFiringPods(new Set());
    setActiveInspectors(new Set());
    setProgressFills([0, 0, 0, 0]);
    setActiveReasoningLines(new Set());
    setMergeDotVisible(false);
    setBrainStatus('waiting');
    setFixVisible(false);
    setDiagVisible(false);
    setCurrentStep(-1);
  }

  function runCycle() {
    reset();
    // Phase 0: detect / scan pods
    T(() => setCurrentStep(0), 300);
    T(() => setFiringPods(new Set([0])), 600);
    T(() => setFiringPods(new Set([0, 1])), 1000);
    T(() => setFiringPods(new Set([0, 1, 3])), 1400);
    // Phase 1: beams cluster → inspectors + inspectors fill
    T(() => addBeam('b1a'), 2000);
    T(() => addBeam('b1b'), 2400);
    T(() => addBeam('b1d'), 2800);
    T(() => addBeam('b1c'), 3200);
    T(() => {
      setCurrentStep(1);
      setActiveInspectors(new Set([0, 1, 2, 3]));
    }, 3800);
    T(() => setProgressFills([100, 0, 0, 0]), 4000);
    T(() => setProgressFills([100, 100, 0, 0]), 4500);
    T(() => setProgressFills([100, 100, 100, 0]), 5000);
    T(() => setProgressFills([100, 100, 100, 100]), 5500);
    // Phase 2: converging beams → AI + reasoning
    T(() => addBeam('b2a'), 6500);
    T(() => addBeam('b2b'), 6900);
    T(() => addBeam('b2c'), 7300);
    T(() => addBeam('b2d'), 7700);
    T(() => setMergeDotVisible(true), 8200);
    T(() => { setCurrentStep(2); setBrainStatus('reasoning'); }, 8700);
    T(() => setActiveReasoningLines(new Set([0])), 9100);
    T(() => setActiveReasoningLines(new Set([0, 1])), 9900);
    T(() => setActiveReasoningLines(new Set([0, 1, 2])), 10700);
    T(() => setActiveReasoningLines(new Set([0, 1, 2, 3])), 11500);
    T(() => setBrainStatus('done'), 12100);
    // Phase 3: beams AI → fix + output
    T(() => addBeam('b3a'), 12500);
    T(() => { addBeam('b3b'); addBeam('b3c'); }, 13000);
    T(() => {
      setCurrentStep(3);
      setFixVisible(true);
      setDiagVisible(true);
    }, 13800);
    // Loop: hold finished state, then restart
    T(() => runCycle(), 18000);
  }

  useEffect(() => {
    runCycle();
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="af-shell">
      <style>{`
        .af-shell {
          display: grid;
          grid-template-columns: 0.82fr 1.18fr;
          gap: 72px;
          align-items: center;
          font-family: var(--font-thicccboi), system-ui, sans-serif;
        }

        /* ── left: workflow explanation ── */
        .af-explain { max-width: 480px; }
        .af-explain-kicker {
          text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px;
          font-weight: 600; color: #7cffb2; margin: 0 0 12px;
        }
        .af-explain-title {
          font-size: clamp(28px, 3.4vw, 40px); line-height: 1.12; letter-spacing: -0.02em;
          font-weight: 600; color: #e9edf1; margin: 0 0 14px;
        }
        .af-explain-title em {
          font-style: italic;
          color: #7cffb2;
        }
        .af-explain-lede { font-size: 13.5px; font-weight: 400; color: #9aa3ad; margin: 0 0 28px; line-height: 1.55; }

        .af-steps { display: flex; flex-direction: column; gap: 10px; }
        .af-step {
          display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start;
          padding: 12px 14px; border-radius: 13px;
          border: 1px solid transparent;
          transition: background .45s ease, border-color .45s ease, box-shadow .45s ease, opacity .45s ease;
          opacity: 0.5;
        }
        .af-step-active {
          opacity: 1;
          background: linear-gradient(120deg, rgba(124,255,178,0.07), rgba(155,140,255,0.05));
          border-color: rgba(124,255,178,0.28);
          box-shadow: 0 0 38px -14px rgba(124,255,178,0.5), inset 0 0 0 1px rgba(124,255,178,0.06);
        }
        .af-step-done { opacity: 0.78; }
        .af-step-num {
          width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12.5px; font-weight: 600; font-family: "JetBrains Mono", monospace;
          color: #6b727b; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          transition: all .45s ease;
        }
        .af-step-active .af-step-num {
          color: #051008; background: linear-gradient(140deg, #7cffb2, #9b8cff);
          border-color: transparent; box-shadow: 0 0 18px -2px rgba(124,255,178,0.6);
        }
        .af-step-done .af-step-num {
          color: #7cffb2; background: rgba(124,255,178,0.1); border-color: rgba(124,255,178,0.3);
        }
        .af-step h4 {
          margin: 4px 0 3px; font-size: 14px; font-weight: 500; letter-spacing: -0.01em; color: #e9edf1;
          display: flex; align-items: center; gap: 7px;
        }
        .af-step-active h4 { color: #fff; }
        .af-step p { margin: 0; font-size: 12px; font-weight: 400; line-height: 1.5; color: #9aa3ad; }

        /* ── right: compact flow panel ── */
        .af-root {
          position: relative;
          border-radius: 22px;
          padding: 20px;
          display: flex; flex-direction: column; gap: 6px;
          background:
            radial-gradient(120% 90% at 12% 0%, rgba(124,255,178,0.08), transparent 55%),
            radial-gradient(120% 90% at 90% 0%, rgba(155,140,255,0.08), transparent 55%),
            linear-gradient(160deg, rgba(255,255,255,0.04), rgba(8,18,11,0.6));
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(22px) saturate(150%);
          -webkit-backdrop-filter: blur(22px) saturate(150%);
          box-shadow: 0 40px 100px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,255,178,0.08) inset;
          overflow: hidden;
        }
        .af-root::before {
          content: ""; position: absolute; inset: 0;
          background-image: linear-gradient(rgba(124,255,178,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,255,178,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(80% 60% at 50% 0%, #000, transparent 75%);
          pointer-events: none;
        }
        .af-layer { position: relative; z-index: 1; }
        .af-label {
          font-size: 8.5px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;
          color: #6b727b; margin: 4px 0 8px;
        }
        .af-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .af-card {
          position: relative; border-radius: 10px; padding: 7px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          transition: border-color .5s ease, box-shadow .5s ease, transform .5s ease, background .5s ease;
        }
        .af-pod-bad { border-color: rgba(255,107,138,0.28); background: rgba(255,107,138,0.06); }
        .af-pod-fire {
          border-color: rgba(124,255,178,0.55) !important;
          box-shadow: 0 0 0 1px rgba(124,255,178,0.4), 0 0 22px -4px rgba(124,255,178,0.45);
          transform: translateY(-2px);
        }
        .af-pod-name { font-size: 9px; font-weight: 600; font-family: "JetBrains Mono", monospace; color: #e9edf1; margin: 0; overflow: hidden; text-overflow: ellipsis; }
        .af-pod-ns { font-size: 8px; color: #6b727b; margin: 1px 0 0; }
        .af-pill {
          display: inline-flex; align-items: center; gap: 3px; font-size: 7.5px; font-weight: 600;
          padding: 2px 5px; border-radius: 999px; margin-top: 5px; border: 1px solid transparent;
          white-space: nowrap; max-width: 100%; overflow: hidden;
        }
        .af-pill .pdot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .af-pill-err  { color: #ff6b8a; background: rgba(255,107,138,0.12); border-color: rgba(255,107,138,0.25); }
        .af-pill-warn { color: #ffb86b; background: rgba(255,184,107,0.12); border-color: rgba(255,184,107,0.25); }
        .af-pill-ok   { color: #7cffb2; background: rgba(124,255,178,0.12); border-color: rgba(124,255,178,0.25); }
        .af-pill-oom  { color: #c9b6ff; background: rgba(155,140,255,0.14); border-color: rgba(155,140,255,0.28); }

        .af-insp { display: flex; flex-direction: column; }
        .af-insp-on { border-color: rgba(124,255,178,0.3); box-shadow: 0 0 20px -8px rgba(124,255,178,0.35); }
        .af-insp-head { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; }
        .af-insp-icon {
          width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; border: 1px solid rgba(255,255,255,0.08);
        }
        .af-insp-name { font-size: 8.5px; font-weight: 600; color: #e9edf1; margin: 0; line-height: 1.15; }
        .af-insp-detail { font-size: 7.5px; color: #9aa3ad; line-height: 1.35; margin: 0; }
        .af-track { height: 2px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 7px; }
        .af-fill { height: 100%; border-radius: 999px; transition: width 1.6s cubic-bezier(0.22,1,0.36,1); }

        .af-panel {
          border-radius: 12px; padding: 12px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        }
        .af-brain { border-color: rgba(155,140,255,0.25); box-shadow: 0 0 34px -16px rgba(155,140,255,0.4); }
        .af-brain-grid { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
        .af-brain-head { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; flex-wrap: wrap; }
        .af-brain-title { font-size: 10px; font-weight: 600; color: #e9edf1; margin: 0; }
        .af-status { font-size: 7.5px; padding: 2px 7px; border-radius: 999px; font-weight: 600; border: 1px solid transparent; }
        .af-status-wait { color: #9b8cff; background: rgba(155,140,255,0.12); border-color: rgba(155,140,255,0.28); }
        .af-status-run  { color: #ffb86b; background: rgba(255,184,107,0.12); border-color: rgba(255,184,107,0.28); }
        .af-status-done { color: #7cffb2; background: rgba(124,255,178,0.12); border-color: rgba(124,255,178,0.28); }
        .af-reason { display: flex; flex-direction: column; gap: 4px; }
        .af-reason-line { display: flex; align-items: flex-start; gap: 5px; font-size: 8.5px; color: #9aa3ad; line-height: 1.35; }
        .af-reason-line .rdot { width: 4px; height: 4px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .af-evidence-label { font-size: 7.5px; font-weight: 600; color: #6b727b; margin: 0 0 5px; }
        .af-evidence { display: flex; flex-direction: column; gap: 4px; min-width: 86px; }
        .af-ev { display: inline-flex; align-items: center; gap: 4px; font-size: 7.5px; font-weight: 600; padding: 2px 7px; border-radius: 999px; border: 1px solid transparent; }

        .af-out-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .af-out { border-radius: 10px; padding: 10px; border: 1px solid rgba(255,255,255,0.08); }
        .af-out-fix { background: rgba(124,255,178,0.05); border-color: rgba(124,255,178,0.22); }
        .af-out-diag { background: rgba(127,211,255,0.05); border-color: rgba(127,211,255,0.22); }
        .af-out-head { display: flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 600; margin: 0 0 6px; }
        .af-code { margin: 0; font-family: "JetBrains Mono", monospace; font-size: 8px; line-height: 1.5; white-space: pre-wrap; color: #aef7d0; transition: opacity .7s ease; }
        .af-diag-body { font-size: 8.5px; line-height: 1.45; color: #bfe6ff; transition: opacity .7s ease; }

        .af-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
        .af-live { font-size: 8.5px; color: #6b727b; display: inline-flex; align-items: center; gap: 5px; }
        .af-live .ldot { width: 5px; height: 5px; border-radius: 999px; background: #7cffb2; box-shadow: 0 0 8px #7cffb2; }
        .af-dots { display: flex; gap: 4px; }
        .af-dot { width: 5px; height: 5px; border-radius: 999px; background: rgba(255,255,255,0.18); transition: all .3s ease; }
        .af-dot-on { background: #7cffb2; transform: scale(1.35); box-shadow: 0 0 10px #7cffb2; }
        .af-dot-past { background: rgba(124,255,178,0.45); }

        /* ── directed dotted arrows ── */
        .af-beam-grp { transition: opacity .45s ease; }
        .af-arrow-base { fill: none; stroke-width: 1; opacity: 0.16; }
        .af-arrow-line {
          fill: none; stroke-width: 1.8; stroke-linecap: round;
          stroke-dasharray: 0.1 6.6;
          animation: af-flow 0.75s linear infinite;
        }
        @keyframes af-flow { to { stroke-dashoffset: -6.7; } }
        @keyframes af-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .af-blink { animation: af-blink 1.2s ease-in-out infinite; }
        @keyframes af-fadeslide { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }
        .af-fade-in { animation: af-fadeslide 0.6s ease forwards; }
        .af-svg { width: 100%; display: block; overflow: visible; }

        @media (max-width: 900px) {
          .af-shell { grid-template-columns: 1fr; gap: 36px; }
          .af-explain { max-width: none; }
        }
        @media (max-width: 560px) {
          .af-brain-grid, .af-out-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ════════ LEFT: workflow explanation ════════ */}
      <div className="af-explain">
        <p className="af-explain-kicker">How Kubric works</p>
        <h2 className="af-explain-title">From a red pod to a <em>shipped fix</em>, automatically.</h2>
        <p className="af-explain-lede">
          Watch the agent move through a live incident — every stage on the right lights up
          as Kubric works through it on the left.
        </p>
        <div className="af-steps">
          {STEPS.map((step, i) => {
            const state = currentStep === i ? 'active' : currentStep > i ? 'done' : 'idle';
            return (
              <div key={i} className={`af-step ${state === 'active' ? 'af-step-active' : ''} ${state === 'done' ? 'af-step-done' : ''}`}>
                <div className="af-step-num">
                  {state === 'done'
                    ? <i className="ti ti-check" style={{ fontSize: 14 }} aria-hidden="true" />
                    : i + 1}
                </div>
                <div>
                  <h4>
                    <i className={`ti ${step.icon}`} style={{ fontSize: 14, color: state === 'active' ? '#7cffb2' : '#6b727b' }} aria-hidden="true" />
                    {step.title}
                  </h4>
                  <p>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════ RIGHT: compact live flow ════════ */}
      <div className="af-root">
        {/* Layer 1: Cluster */}
        <div className="af-layer">
          <p className="af-label">Your kubernetes cluster</p>
          <div className="af-grid4">
            {[
              { name: 'payment-svc', ns: 'payments', status: 'CrashLoop', type: 'crash' },
              { name: 'order-api',   ns: 'orders',   status: 'ImagePull', type: 'pull'  },
              { name: 'auth-svc',    ns: 'platform', status: 'Running',   type: 'ok'    },
              { name: 'worker-job',  ns: 'jobs',     status: 'OOMKilled', type: 'oom'   },
            ].map((pod, i) => (
              <div key={i} className={`af-card ${pod.type !== 'ok' ? 'af-pod-bad' : ''} ${firingPods.has(i) ? 'af-pod-fire' : ''}`}>
                <p className="af-pod-name">{pod.name}</p>
                <p className="af-pod-ns">ns: {pod.ns}</p>
                <span className={`af-pill ${pod.type === 'crash' ? 'af-pill-err' : ''}${pod.type === 'pull' ? 'af-pill-warn' : ''}${pod.type === 'ok' ? 'af-pill-ok' : ''}${pod.type === 'oom' ? 'af-pill-oom' : ''}`}>
                  <span className={`pdot ${pod.type !== 'ok' ? 'af-blink' : ''}`} />
                  {pod.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Beam SVG 1 — directed dotted arrows */}
        <svg viewBox="0 0 640 28" className="af-svg af-layer" height={28} preserveAspectRatio="none">
          <defs>
            <marker id="af-arrow" viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M1.5,2 L8,5 L1.5,8" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {[
            { id: 'b1a', d: 'M80,2 L80,24',   color: '#ff6b8a', delay: '0s'   },
            { id: 'b1b', d: 'M240,2 L240,24', color: '#ffb86b', delay: '0.18s' },
            { id: 'b1c', d: 'M400,2 L400,24', color: '#9aa3ad', delay: '0.36s' },
            { id: 'b1d', d: 'M560,2 L560,24', color: '#9b8cff', delay: '0.27s' },
          ].map(b => (
            <g key={b.id} className="af-beam-grp" style={{ opacity: activeBeams.has(b.id) ? 1 : 0 }}>
              <path className="af-arrow-base" d={b.d} stroke={b.color} />
              <path className="af-arrow-line" d={b.d} stroke={b.color} markerEnd="url(#af-arrow)" style={{ filter: `drop-shadow(0 0 3px ${b.color})`, animationDelay: b.delay }} />
            </g>
          ))}
        </svg>

        {/* Layer 2: Inspectors */}
        <div className="af-layer">
          <p className="af-label">Kubric inspectors</p>
          <div className="af-grid4">
            {[
              { icon: 'ti-circles-relation', name: 'Pod', detail: 'describe + get', glow: 'rgba(255,107,138,0.16)', iconColor: '#ff6b8a', fill: 'linear-gradient(90deg,#ff6b8a,#ff9bb0)' },
              { icon: 'ti-terminal',         name: 'Logs', detail: 'current + prev', glow: 'rgba(255,184,107,0.16)', iconColor: '#ffb86b', fill: 'linear-gradient(90deg,#ffb86b,#ffd9a8)' },
              { icon: 'ti-topology-star',    name: 'Events', detail: 'warnings', glow: 'rgba(155,140,255,0.16)', iconColor: '#9b8cff', fill: 'linear-gradient(90deg,#9b8cff,#c9b6ff)' },
              { icon: 'ti-network',          name: 'Network', detail: 'DNS + endpoints', glow: 'rgba(124,255,178,0.16)', iconColor: '#7cffb2', fill: 'linear-gradient(90deg,#7cffb2,#b6ffd8)' },
            ].map((insp, i) => (
              <div key={i} className={`af-card af-insp ${activeInspectors.has(i) ? 'af-insp-on' : ''}`}>
                <div className="af-insp-head">
                  <div className="af-insp-icon" style={{ background: insp.glow }}>
                    <i className={`ti ${insp.icon}`} style={{ color: insp.iconColor, fontSize: 11 }} aria-hidden="true" />
                  </div>
                  <p className="af-insp-name">{insp.name}</p>
                </div>
                <p className="af-insp-detail">{insp.detail}</p>
                <div className="af-track">
                  <div className="af-fill" style={{ width: `${progressFills[i]}%`, background: insp.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Beam SVG 2 — directed dotted arrows converging */}
        <svg viewBox="0 0 640 38" className="af-svg af-layer" height={38} preserveAspectRatio="none">
          {[
            { id: 'b2a', d: 'M80,2 Q80,22 320,36',  color: '#ff6b8a', delay: '0s'   },
            { id: 'b2b', d: 'M240,2 Q240,22 320,36', color: '#ffb86b', delay: '0.18s' },
            { id: 'b2c', d: 'M400,2 Q400,22 320,36', color: '#9b8cff', delay: '0.36s' },
            { id: 'b2d', d: 'M560,2 Q560,22 320,36', color: '#7cffb2', delay: '0.27s' },
          ].map(b => (
            <g key={b.id} className="af-beam-grp" style={{ opacity: activeBeams.has(b.id) ? 1 : 0 }}>
              <path className="af-arrow-base" d={b.d} stroke={b.color} />
              <path className="af-arrow-line" d={b.d} stroke={b.color} markerEnd="url(#af-arrow)" style={{ filter: `drop-shadow(0 0 3px ${b.color})`, animationDelay: b.delay }} />
            </g>
          ))}
          <circle cx={320} cy={36} r={4} fill="#7cffb2"
            style={{ opacity: mergeDotVisible ? 1 : 0, transition: 'opacity .5s ease', filter: 'drop-shadow(0 0 10px #7cffb2)' }}
            className={mergeDotVisible ? 'af-blink' : ''} />
        </svg>

        {/* Layer 3: AI Brain */}
        <div className="af-layer">
          <p className="af-label">AI reasoning engine</p>
          <div className="af-panel af-brain af-brain-grid">
            <div>
              <div className="af-brain-head">
                <i className="ti ti-brain" style={{ color: '#9b8cff', fontSize: 12 }} aria-hidden="true" />
                <p className="af-brain-title">Kubric reasoning engine</p>
                <span className={`af-status ${brainStatus === 'waiting' ? 'af-status-wait' : ''}${brainStatus === 'reasoning' ? 'af-status-run' : ''}${brainStatus === 'done' ? 'af-status-done' : ''}`}>
                  {brainStatus === 'waiting' ? 'Waiting' : brainStatus === 'reasoning' ? 'Reasoning...' : 'Done'}
                </span>
              </div>
              <div className="af-reason">
                {[
                  'payment-svc OOMKilled — limit 128Mi exceeded',
                  'Logs confirm OutOfMemoryError before crash',
                  'order-api :latest — registry token expired',
                  'Root cause found — 2 fixes ready',
                ].map((line, i) => (
                  <div key={i} className={`af-reason-line ${activeReasoningLines.has(i) ? 'af-fade-in' : ''}`} style={{ opacity: activeReasoningLines.has(i) ? undefined : 0 }}>
                    <span className="rdot" style={{ background: i === 3 ? '#7cffb2' : '#9b8cff', boxShadow: i === 3 ? '0 0 8px #7cffb2' : 'none' }} />
                    {line}
                  </div>
                ))}
              </div>
            </div>
            <div className="af-evidence">
              <p className="af-evidence-label">Evidence</p>
              {[
                { icon: 'ti-circles-relation', label: '4 pods',   color: '#ff6b8a', bg: 'rgba(255,107,138,0.1)', bd: 'rgba(255,107,138,0.25)' },
                { icon: 'ti-terminal',         label: '312 logs',  color: '#ffb86b', bg: 'rgba(255,184,107,0.1)', bd: 'rgba(255,184,107,0.25)' },
                { icon: 'ti-topology-star',    label: '18 events', color: '#9b8cff', bg: 'rgba(155,140,255,0.1)', bd: 'rgba(155,140,255,0.25)' },
                { icon: 'ti-network',          label: '6 routes',  color: '#7cffb2', bg: 'rgba(124,255,178,0.1)', bd: 'rgba(124,255,178,0.25)' },
              ].map((pill, i) => (
                <span key={i} className="af-ev" style={{ color: pill.color, background: pill.bg, borderColor: pill.bd }}>
                  <i className={`ti ${pill.icon}`} style={{ fontSize: 9 }} aria-hidden="true" />
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Beam SVG 3 — directed dotted arrows */}
        <svg viewBox="0 0 640 24" className="af-svg af-layer" height={24} preserveAspectRatio="none">
          {[
            { id: 'b3a', d: 'M320,2 L320,22',         delay: '0s'   },
            { id: 'b3b', d: 'M320,12 Q240,18 160,22', delay: '0.2s' },
            { id: 'b3c', d: 'M320,12 Q400,18 480,22', delay: '0.2s' },
          ].map(b => (
            <g key={b.id} className="af-beam-grp" style={{ opacity: activeBeams.has(b.id) ? 1 : 0 }}>
              <path className="af-arrow-base" d={b.d} stroke="#7cffb2" />
              <path className="af-arrow-line" d={b.d} stroke="#7cffb2" markerEnd="url(#af-arrow)" style={{ filter: 'drop-shadow(0 0 3px #7cffb2)', animationDelay: b.delay }} />
            </g>
          ))}
        </svg>

        {/* Layer 4: Fix */}
        <div className="af-layer">
          <p className="af-label">Remediation output</p>
          <div className="af-out-grid">
            <div className="af-out af-out-fix">
              <p className="af-out-head" style={{ color: '#7cffb2' }}>
                <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true" /> Fix commands
              </p>
              <pre className="af-code" style={{ opacity: fixVisible ? 1 : 0 }}>{`kubectl set resources \\
  deploy/payment-svc \\
  --limits=memory=512Mi
kubectl delete pod \\
  order-api-6bc8`}</pre>
            </div>
            <div className="af-out af-out-diag">
              <p className="af-out-head" style={{ color: '#7fd3ff' }}>
                <i className="ti ti-file-description" style={{ fontSize: 11 }} aria-hidden="true" /> Diagnosis
              </p>
              <div className="af-diag-body" style={{ opacity: diagVisible ? 1 : 0 }}>
                payment-svc OOMKilled — heap exceeds 128Mi. Raise to 512Mi.
                <br /><br />
                order-api token expired — restart to re-auth.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="af-footer af-layer">
          <span className="af-live"><span className="ldot af-blink" /> Live · looping</span>
          <div className="af-dots">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`af-dot ${currentStep === i ? 'af-dot-on' : currentStep > i ? 'af-dot-past' : ''}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
