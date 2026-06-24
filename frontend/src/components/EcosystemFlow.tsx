'use client';

import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Rounded orthogonal path helper — builds an SVG path from waypoints
 * with smooth rounded corners (LiteLLM-style connector routing).
 * ------------------------------------------------------------------ */
type Pt = [number, number];

function dist(a: Pt, b: Pt) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
function unit(from: Pt, to: Pt): Pt {
  const d = dist(from, to) || 1;
  return [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
}
function roundedPath(points: Pt[], r = 18): string {
  if (points.length < 3) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`;
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const v1 = unit(p1, p0);
    const v2 = unit(p1, p2);
    const d1 = Math.min(r, dist(p0, p1) / 2);
    const d2 = Math.min(r, dist(p1, p2) / 2);
    const a: Pt = [p1[0] + v1[0] * d1, p1[1] + v1[1] * d1];
    const b: Pt = [p1[0] + v2[0] * d2, p1[1] + v2[1] * d2];
    d += ` L ${a[0].toFixed(1)} ${a[1].toFixed(1)} Q ${p1[0]} ${p1[1]} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

// Connector geometry — coordinate space 1024 x 480.
// Panel center (475,240), width 264, height 250 -> spans x[343,607] y[115,365].
// Connector geometry — coordinate space 1024 x 480.
// Panel center (475,240), width 300, height 300 -> spans x[325,625] y[90,390].
const LINES = [
  { id: 'l-user', group: -1, d: roundedPath([[172, 240], [325, 240]]) },
  { id: 'l-in0',  group: 0,  d: roundedPath([[625, 170], [684, 170], [684, 106], [726, 106]]) },
  { id: 'l-out0', group: 0,  d: roundedPath([[782, 106], [1024, 106]]) },
  { id: 'l-in1',  group: 1,  d: roundedPath([[625, 240], [726, 240]]) },
  { id: 'l-out1', group: 1,  d: roundedPath([[782, 240], [1024, 240]]) },
  { id: 'l-in2',  group: 2,  d: roundedPath([[625, 310], [684, 310], [684, 374], [726, 374]]) },
  { id: 'l-out2', group: 2,  d: roundedPath([[782, 374], [1024, 374]]) },
];

const FEATURES_LEFT = ['Pod Inspector', 'Log Analysis', 'Event Triage', 'Root Cause AI', 'Crash Diagnosis'];
const FEATURES_RIGHT = ['Network Probes', 'OOM Detection', 'Auto Remediation', 'Audit Trails', 'Multi-Cluster'];

/* ---- Kubernetes ecosystem logos (monochrome, currentColor) ---- */
function KubernetesLogo() {
  const outer: Pt[] = [
    [12, 3], [19.04, 6.39], [20.77, 14], [15.91, 20.11],
    [8.09, 20.11], [3.23, 14], [4.96, 6.39],
  ];
  const inner: Pt[] = [
    [12, 8.5], [14.74, 9.82], [15.41, 12.78], [13.52, 15.15],
    [10.48, 15.15], [8.59, 12.78], [9.26, 9.82],
  ];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <polygon points={outer.map(p => p.join(',')).join(' ')} strokeWidth="1.3" strokeLinejoin="round" />
      <polygon points={inner.map(p => p.join(',')).join(' ')} strokeWidth="1" strokeLinejoin="round" opacity="0.85" />
      {outer.map((o, i) => (
        <line key={i} x1={inner[i][0]} y1={inner[i][1]} x2={o[0]} y2={o[1]} strokeWidth="0.9" opacity="0.7" />
      ))}
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function HelmLogo() {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return [12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9];
  });
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="2.6" strokeWidth="1.2" />
      {spokes.map((s, i) => (
        <g key={i}>
          <line x1="12" y1="12" x2={s[0].toFixed(2)} y2={s[1].toFixed(2)} strokeWidth="0.9" opacity="0.8" />
          <circle cx={s[0].toFixed(2)} cy={s[1].toFixed(2)} r="1.3" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}
function PrometheusLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M12 2.5c2.4 2.5 1.2 4.6 0.4 5.8-0.7 1.1-1 2.4 0.2 3.4 1-0.3 1.4-1.2 1.5-2.1 1.3 1.4 2 3 2 4.7a6.6 6.6 0 1 1-13.2 0c0-2.6 1.4-4.8 2.7-6.1-0.2 1.6 0.3 2.7 1.1 3.1 1-1.1 0.4-2.6-0.1-4C7.7 8 8.6 4.7 12 2.5Z"
        strokeWidth="1.2" strokeLinejoin="round"
      />
      <rect x="7.5" y="19.2" width="9" height="2.3" rx="0.8" strokeWidth="1.2" />
    </svg>
  );
}
function UserLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="8" r="4" strokeWidth="1.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const PROVIDERS = [
  { logo: <KubernetesLogo />, label: 'Kubernetes', detail: 'Reads pod, node & deployment state across every namespace.', cx: 754, cy: 106 },
  { logo: <HelmLogo />,       label: 'Helm',       detail: 'Inspects releases, values & rollout history for drift.', cx: 754, cy: 240 },
  { logo: <PrometheusLogo />, label: 'Prometheus', detail: 'Correlates metrics, alerts & resource pressure in real time.', cx: 754, cy: 374 },
];

const X = (n: number) => `${(n / 1024) * 100}%`;
const Y = (n: number) => `${(n / 480) * 100}%`;

export default function EcosystemFlow() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActive(prev => (prev + 1) % PROVIDERS.length);
    }, 2600);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const current = hovered ?? active;

  return (
    <div className="eco">
      <style>{`
        /* container-query unit (cqw) drives ALL sizing so the whole
           illustration scales proportionally with its own width and
           never overflows, regardless of viewport. */
        .eco {
          container-type: inline-size;
          position: relative;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          aspect-ratio: 1024 / 480;
          overflow: visible;
          background: transparent;
          border: none;
          border-radius: 0;
          font-family: var(--font-thicccboi), system-ui, sans-serif;
        }
        .eco::before {
          content: "";
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(124,255,178,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,255,178,0.08) 1px, transparent 1px);
          background-size: 3.3cqw 3.3cqw;
          mask-image: radial-gradient(75% 75% at 50% 50%, #000, transparent 95%);
          pointer-events: none;
        }
        .eco-lines { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
        .eco-wire { fill: none; stroke: rgba(124,255,178,0.16); stroke-width: 1.4; transition: stroke .4s ease; }
        .eco-wire.act { stroke: rgba(124,255,178,0.4); }
        .eco-flow {
          fill: none; stroke: rgba(124,255,178,0.5); stroke-width: 1.4; stroke-linecap: round;
          stroke-dasharray: 1.5 16;
          animation: eco-march 1.1s linear infinite;
          transition: stroke .4s ease, stroke-width .4s ease;
        }
        .eco-flow.act { stroke: #7cffb2; stroke-width: 1.8; filter: drop-shadow(0 0 5px #7cffb2); }
        @keyframes eco-march { to { stroke-dashoffset: -35; } }
        .pkt { fill: #7cffb2; opacity: 0.5; transition: opacity .4s ease; }
        .pkt.act { opacity: 1; filter: drop-shadow(0 0 6px #7cffb2); }

        .eco-node, .eco-panel, .eco-prov {
          position: absolute; transform: translate(-50%, -50%); z-index: 2;
        }

        /* user node */
        .eco-user {
          width: 8.6cqw; height: 8.6cqw;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6cqw;
          border-radius: 1.6cqw; color: #7cffb2;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 0 40px -10px rgba(124,255,178,0.6), inset 0 0 0 1px rgba(255,255,255,0.03);
        }
        .eco-user svg { width: 2.9cqw; height: 2.9cqw; }
        .eco-user span { font-size: 1.1cqw; color: #9aa3ad; font-weight: 500; }

        /* central kubric panel */
        .eco-panel {
          left: ${X(475)}; top: ${Y(240)};
          width: 29.3cqw; height: 29.3cqw;
          border-radius: 1.7cqw;
          padding-top: 2cqw;
          padding-left: 1.7cqw;
          padding-right: 1.7cqw;
          padding-bottom: 4cqw;
          display: flex; flex-direction: column; overflow: hidden;
          background: linear-gradient(160deg, rgba(124,255,178,0.06), rgba(8,18,11,0.72));
          border: 1px solid rgba(124,255,178,0.18);
          backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%);
          box-shadow: 0 30px 80px -28px rgba(0,0,0,0.8), 0 0 70px -18px rgba(124,255,178,0.45), inset 0 0 0 1px rgba(255,255,255,0.04);
        }
        .eco-brand { display: flex; align-items: center; justify-content: center; gap: 0.9cqw; margin-bottom: 1.5cqw; }
        .eco-brand-mark {
          width: 1.9cqw; height: 1.9cqw; border-radius: 0.6cqw;
          background: conic-gradient(from 210deg, #7cffb2, #2fae6e, #7cffb2);
          box-shadow: 0 0 16px rgba(124,255,178,0.5);
        }
        .eco-brand-name { font-size: 1.7cqw; font-weight: 700; letter-spacing: -0.02em; color: #fff; }
        .eco-pills { display: grid; grid-template-columns: 1fr 1fr; gap: 1.3cqw; flex: 1; min-height: 0; }
        .eco-col { display: flex; flex-direction: column; justify-content: space-between; gap: 1cqw; }
        .eco-pill {
          display: flex; align-items: center; justify-content: center;
          font-size: 0.92cqw; font-weight: 500; line-height: 1; letter-spacing: -0.01em;
          padding: 0.85cqw 0.4cqw; border-radius: 0.75cqw; text-align: center; white-space: nowrap;
          color: #d4dbe2;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          opacity: 0;
          transform: translateY(6px);
          animation: eco-pop 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
          transition: border-color .25s ease, color .25s ease, background .25s ease, box-shadow .25s ease;
          cursor: default;
        }
        .eco-pill:hover {
          color: #fff;
          border-color: rgba(124,255,178,0.5);
          background: rgba(124,255,178,0.1);
          box-shadow: 0 0 18px -6px rgba(124,255,178,0.6);
        }
        .eco-pill.dim { color: #d4dbe2; background: rgba(255,255,255,0.02); }
        @keyframes eco-pop { to { opacity: 1; transform: translateY(0); } }

        /* provider nodes */
        .eco-prov {
          width: 5.3cqw; height: 5.3cqw; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border-radius: 1.4cqw; color: #cfd6df;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 0 22px -12px rgba(124,255,178,0.3), inset 0 0 0 1px rgba(255,255,255,0.03);
          transition: transform .4s cubic-bezier(0.22,1,0.36,1), border-color .4s ease, box-shadow .4s ease, color .4s ease;
        }
        .eco-prov svg { width: 3.2cqw; height: 3.2cqw; transition: transform .4s ease; }
        .eco-prov.act {
          color: #7cffb2;
          border-color: rgba(124,255,178,0.55);
          box-shadow: 0 0 34px -8px rgba(124,255,178,0.7), inset 0 0 0 1px rgba(124,255,178,0.12);
          transform: translate(-50%, -50%) scale(1.14);
        }
        .eco-prov.act svg { transform: scale(1.05); }
        .eco-prov-label {
          position: absolute; top: 118%; left: 50%; transform: translateX(-50%);
          font-size: 1cqw; font-weight: 500; white-space: nowrap;
          color: #6b727b; transition: color .4s ease;
        }
        .eco-prov.act .eco-prov-label { color: #7cffb2; }

        /* rotating detail caption */
        .eco-detail {
          position: absolute; left: 4cqw; bottom: 2.4cqw; z-index: 3;
          display: flex; align-items: center; gap: 0.9cqw; max-width: 26cqw;
        }
        .eco-detail-dot { width: 0.7cqw; height: 0.7cqw; border-radius: 50%; background: #7cffb2; box-shadow: 0 0 10px #7cffb2; flex-shrink: 0; }
        .eco-detail-text { font-size: 1.15cqw; line-height: 1.4; color: #9aa3ad; }
        .eco-detail-text b { color: #e9edf1; font-weight: 600; }
        .eco-detail-key { animation: eco-detail-in 0.5s ease; }
        @keyframes eco-detail-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* connector lines + traveling packets */}
      <svg className="eco-lines" viewBox="0 0 1024 480" preserveAspectRatio="xMidYMid meet">
        <defs>
          {LINES.map(l => <path key={`def-${l.id}`} id={l.id} d={l.d} />)}
        </defs>
        {LINES.map(l => {
          const isAct = l.group === current || l.group === -1;
          return <use key={`w-${l.id}`} href={`#${l.id}`} className={`eco-wire ${isAct ? 'act' : ''}`} />;
        })}
        {LINES.map(l => {
          const isAct = l.group === current || l.group === -1;
          return <use key={`f-${l.id}`} href={`#${l.id}`} className={`eco-flow ${isAct ? 'act' : ''}`} />;
        })}
        {LINES.map(l => {
          const isAct = l.group === current || l.group === -1;
          return (
            <circle key={`p-${l.id}`} className={`pkt ${isAct ? 'act' : ''}`} r={isAct ? 3 : 1.8}>
              <animateMotion dur="1.5s" repeatCount="indefinite" rotate="auto">
                <mpath href={`#${l.id}`} />
              </animateMotion>
            </circle>
          );
        })}
      </svg>

      {/* user node */}
      <div className="eco-node eco-user" style={{ left: X(128), top: Y(240) }}>
        <UserLogo />
        <span>User</span>
      </div>

      {/* central panel */}
      <div className="eco-panel">
        <div className="eco-brand">
          <span className="eco-brand-mark" />
          <span className="eco-brand-name">Kubric</span>
        </div>
        <div className="eco-pills">
          <div className="eco-col">
            {FEATURES_LEFT.map((f, i) => (
              <span key={f} className={`eco-pill ${i >= 4 ? 'dim' : ''}`} style={{ animationDelay: `${i * 0.07}s` }}>{f}</span>
            ))}
          </div>
          <div className="eco-col">
            {FEATURES_RIGHT.map((f, i) => (
              <span key={f} className={`eco-pill ${i >= 3 ? 'dim' : ''}`} style={{ animationDelay: `${(i + 0.5) * 0.07}s` }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* provider nodes */}
      {PROVIDERS.map((p, i) => (
        <div
          key={p.label}
          className={`eco-prov ${current === i ? 'act' : ''}`}
          style={{ left: X(p.cx), top: Y(p.cy) }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          {p.logo}
          <span className="eco-prov-label">{p.label}</span>
        </div>
      ))}

      {/* rotating detail caption */}
      <div className="eco-detail">
        <span className="eco-detail-dot" />
        <span key={current} className="eco-detail-text eco-detail-key">
          <b>{PROVIDERS[current].label}</b> — {PROVIDERS[current].detail}
        </span>
      </div>
    </div>
  );
}
