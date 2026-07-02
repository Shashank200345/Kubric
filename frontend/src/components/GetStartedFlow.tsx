'use client';

import { useEffect, useState } from 'react';

/**
 * Kubric "how it works" hub — a live self-healing journey:
 *   Cluster (a pod fails)  →  Kubric core reasons  →  fix ships, pod heals.
 * The three onboarding steps light up in sync with the animation loop.
 *
 * Left/center/right visual lives in one aspect-locked SVG (perfect alignment);
 * the three step cards render as responsive HTML below it.
 */

const STEPS = [
  {
    tag: 'STEP 01',
    title: 'Connect your cluster',
    desc: 'One Helm command, read-only by default. Kubric starts watching events, logs, metrics, and traces.',
  },
  {
    tag: 'STEP 02',
    title: 'Kubric investigates',
    desc: 'It correlates signals across the stack and reasons to the real root cause — not just the symptom.',
  },
  {
    tag: 'STEP 03',
    title: 'Ship the fix',
    desc: 'Approve the patch. Kubric applies it, then verifies the workload recovers. MTTR in seconds.',
  },
];

export default function GetStartedFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % 3), 2600);
    return () => clearInterval(id);
  }, []);

  const healed = active === 2;

  // 3x3 pod grid coordinates around the Connect node (center 140,160).
  const gridX = [116, 140, 164];
  const gridY = [136, 160, 184];

  return (
    <div className="of">
      <div className="of-frame">
        <svg className="of-svg" viewBox="0 0 1000 320" role="img" aria-label="Kubric detects an incident, finds the root cause, and ships a fix">
          <defs>
            <radialGradient id="of-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(124,255,178,0.5)" />
              <stop offset="60%" stopColor="rgba(124,255,178,0.08)" />
              <stop offset="100%" stopColor="rgba(124,255,178,0)" />
            </radialGradient>
            <filter id="of-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ============ WIRE 1: cluster → core ============ */}
          <g className={`of-wire ${active >= 1 ? 'hot' : ''}`}>
            <line x1="196" y1="160" x2="416" y2="160" stroke="rgba(124,255,178,0.16)" strokeWidth="1.5" />
            <line className="of-wire-flow" x1="196" y1="160" x2="416" y2="160" stroke="#7cffb2" strokeWidth="1.5" strokeDasharray="2 8" />
            <circle className="of-packet p1" r="3" fill="#7cffb2" />
            <circle className="of-packet p1 d2" r="2.4" fill="#7cffb2" />
          </g>

          {/* ============ WIRE 2: core → resolve ============ */}
          <g className={`of-wire ${healed ? 'hot' : ''}`}>
            <line x1="584" y1="160" x2="804" y2="160" stroke="rgba(124,255,178,0.16)" strokeWidth="1.5" />
            <line className="of-wire-flow" x1="584" y1="160" x2="804" y2="160" stroke="#7cffb2" strokeWidth="1.5" strokeDasharray="2 8" />
            {healed && <circle className="of-packet p2" r="3.2" fill="#7cffb2" />}
          </g>

          {/* ============ CONNECT NODE (pod grid) ============ */}
          <g className={`of-node ${active === 0 ? 'is-active' : ''}`}>
            <rect x="96" y="116" width="88" height="88" fill="rgba(10,15,12,0.7)" stroke="rgba(124,255,178,0.22)" strokeWidth="1" className="of-node-box" />
            {gridY.map((gy, r) =>
              gridX.map((gx, c) => {
                const isIncident = r === 1 && c === 1;
                if (isIncident) {
                  return (
                    <circle
                      key={`${r}-${c}`}
                      cx={gx}
                      cy={gy}
                      r="6"
                      className={healed ? 'of-pod-ok' : 'of-pod-bad'}
                      fill={healed ? '#7cffb2' : '#ff6b6b'}
                    />
                  );
                }
                return <circle key={`${r}-${c}`} cx={gx} cy={gy} r="4.5" fill="rgba(124,255,178,0.35)" />;
              })
            )}
          </g>

          {/* ============ KUBRIC CORE ============ */}
          <g>
            <circle cx="500" cy="160" r="72" fill="url(#of-core)" className={active === 1 ? 'of-core-hot' : 'of-core'} />
            <circle cx="500" cy="160" r="52" fill="none" stroke="rgba(124,255,178,0.16)" strokeWidth="1" className="of-ring r1" />
            <circle cx="500" cy="160" r="52" fill="none" stroke="rgba(124,255,178,0.35)" strokeWidth="1.4" strokeDasharray="3 7" className="of-ring-rot" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
            <circle cx="500" cy="160" r="34" fill="rgba(6,10,8,0.85)" stroke="rgba(124,255,178,0.4)" strokeWidth="1" filter="url(#of-glow)" />
            <image href="/kubric-logo.png" x="474" y="134" width="52" height="52" style={{ filter: 'drop-shadow(0 0 6px rgba(124,255,178,0.6))' }} />
          </g>

          {/* ============ RESOLVE NODE (healing pod) ============ */}
          <g className={`of-node ${healed ? 'is-active' : ''}`}>
            <rect x="816" y="116" width="88" height="88" fill="rgba(10,15,12,0.7)" stroke="rgba(124,255,178,0.22)" strokeWidth="1" className="of-node-box" />
            <circle cx="860" cy="160" r="26" fill={healed ? 'rgba(124,255,178,0.14)' : 'rgba(255,107,107,0.12)'} stroke={healed ? 'rgba(124,255,178,0.7)' : 'rgba(255,107,107,0.65)'} strokeWidth="1.4" className={`of-heal ${healed ? 'ok' : 'bad'}`} />
            <text x="860" y="169" textAnchor="middle" fontSize="24" fontWeight="700" fill={healed ? '#7cffb2' : '#ff6b6b'} fontFamily="var(--font-inter), sans-serif">
              {healed ? '✓' : '!'}
            </text>
          </g>

          {/* stage labels */}
          <text x="140" y="228" textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="rgba(255,255,255,0.45)" fontFamily="var(--font-jetbrains-mono), monospace">CLUSTER</text>
          <text x="500" y="256" textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="rgba(255,255,255,0.45)" fontFamily="var(--font-jetbrains-mono), monospace">KUBRIC CORE</text>
          <text x="860" y="228" textAnchor="middle" fontSize="11" letterSpacing="1.5" fill="rgba(255,255,255,0.45)" fontFamily="var(--font-jetbrains-mono), monospace">RESOLVED</text>
        </svg>
      </div>

      {/* ============ STEP CARDS ============ */}
      <div className="of-steps">
        {STEPS.map((s, i) => (
          <div key={s.tag} className={`of-card ${active === i ? 'is-active' : ''}`}>
            <div className="of-card-head">
              <span className="of-card-tag">{s.tag}</span>
              <span className="of-card-dot" />
            </div>
            <h4 className="of-card-title">{s.title}</h4>
            <p className="of-card-desc">{s.desc}</p>
          </div>
        ))}
      </div>

      <style>{`
        .of { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 34px; }
        .of-frame { position: relative; width: 100%; max-width: 940px; aspect-ratio: 1000 / 320; }
        .of-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }

        /* wires */
        .of-wire-flow { opacity: 0.35; animation: of-dash 0.9s linear infinite; transition: opacity .4s ease; }
        .of-wire.hot .of-wire-flow { opacity: 0.95; }
        .of-packet { opacity: 0; }
        .of-wire.hot .of-packet.p1 { opacity: 1; animation: of-travel1 1.5s linear infinite; }
        .of-packet.p1.d2 { animation-delay: 0.75s; }
        .of-packet.p2 { opacity: 1; animation: of-travel2 1.1s linear infinite; }

        @keyframes of-dash { to { stroke-dashoffset: -20; } }
        @keyframes of-travel1 { 0% { transform: translate(196px,160px); opacity:0; } 12%{opacity:1;} 88%{opacity:1;} 100% { transform: translate(416px,160px); opacity:0; } }
        @keyframes of-travel2 { 0% { transform: translate(584px,160px); opacity:0; } 15%{opacity:1;} 85%{opacity:1;} 100% { transform: translate(804px,160px); opacity:0; } }

        /* nodes */
        .of-node .of-node-box { transition: stroke .4s ease, filter .4s ease; }
        .of-node.is-active .of-node-box { stroke: rgba(124,255,178,0.7); filter: drop-shadow(0 0 10px rgba(124,255,178,0.25)); }

        .of-pod-bad { animation: of-badpulse 1s ease-in-out infinite; }
        .of-pod-ok { animation: of-pop .5s ease; }
        @keyframes of-badpulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes of-pop { 0% { transform: scale(0.4); transform-box: fill-box; transform-origin: center; } 60% { transform: scale(1.25); transform-box: fill-box; transform-origin: center; } 100% { transform: scale(1); transform-box: fill-box; transform-origin: center; } }

        /* core */
        .of-core { opacity: 0.7; transition: opacity .4s ease; }
        .of-core-hot { opacity: 1; animation: of-corepulse 1.3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes of-corepulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        .of-ring-rot { animation: of-spin 9s linear infinite; }
        @keyframes of-spin { to { transform: rotate(360deg); } }

        .of-heal { transition: all .4s ease; }
        .of-heal.ok { animation: of-pop .5s ease; transform-box: fill-box; transform-origin: center; }

        /* step cards */
        .of-steps { width: 100%; max-width: 940px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .of-card { padding: 20px; background: rgba(12,17,14,0.6); border: 0.5px solid rgba(124,255,178,0.14); transition: border-color .35s ease, background .35s ease, transform .35s ease; }
        .of-card.is-active { border-color: rgba(124,255,178,0.55); background: rgba(124,255,178,0.05); transform: translateY(-3px); }
        .of-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .of-card-tag { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; letter-spacing: 1.5px; color: #7cffb2; }
        .of-card-dot { width: 7px; height: 7px; background: rgba(124,255,178,0.25); transition: all .35s ease; }
        .of-card.is-active .of-card-dot { background: #7cffb2; box-shadow: 0 0 8px #7cffb2; }
        .of-card-title { font-size: 17px; font-weight: 600; color: #e9edf1; margin: 0 0 8px; }
        .of-card-desc { font-size: 13.5px; line-height: 1.6; color: rgba(255,255,255,0.5); margin: 0; }

        @media (max-width: 760px) {
          .of-steps { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .of-wire-flow, .of-packet, .of-pod-bad, .of-core-hot, .of-ring-rot, .of-heal.ok, .of-pod-ok { animation: none; }
        }
      `}</style>
    </div>
  );
}
