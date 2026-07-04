'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bento proof section for Kubric — professional, self-animating illustrations:
 *   1. copy + CTA with live mini-stats
 *   2. MTTR analytics chart (draw-in line, axis labels, value callout)
 *   3. radar "every cluster watched" (sweep beam + labeled nodes)
 *   4. live agent diagnostic checklist that runs to a root-cause + fix
 */

function smooth(points: { x: number; y: number }[]) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i - 1].x + points[i].x) / 2;
    const yc = (points[i - 1].y + points[i].y) / 2;
    d += ` Q ${points[i - 1].x} ${points[i - 1].y} ${xc} ${yc}`;
  }
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

const CHART_PTS = [
  { x: 42, y: 28 },
  { x: 114, y: 36 },
  { x: 186, y: 52 },
  { x: 258, y: 86 },
  { x: 330, y: 128 },
  { x: 400, y: 158 },
];

const TRACE: { t: string; title: string; sub?: string; bad?: boolean; verdict?: boolean; badge?: string }[] = [
  { t: '00:00', title: 'Incident detected', sub: 'payment-svc · replicas 0/3', bad: true, badge: 'CrashLoopBackOff' },
  { t: '00:01', title: 'Signals gathered', sub: '42 pods scanned · 3 warning events' },
  { t: '00:02', title: 'Correlated logs & image history' },
  { t: '00:03', title: 'Root cause identified', verdict: true },
];
// phases: 0..3 advancing timeline nodes, +3 to hold the result before looping
const TOTAL_PHASES = TRACE.length + 3;

export default function ProofBento() {
  const router = useRouter();
  const line = smooth(CHART_PTS);
  const area = `${line} L 400 172 L 42 172 Z`;

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setPhase(TOTAL_PHASES - 1);
      return;
    }
    const id = setInterval(() => setPhase((p) => (p + 1) % TOTAL_PHASES), 850);
    return () => clearInterval(id);
  }, []);
  const resultOpen = phase >= TRACE.length - 1;
  const fillPct = phase <= 0 ? '0%' : phase >= TRACE.length - 1 ? '100%' : `${(phase / (TRACE.length - 1)) * 100}%`;

  return (
    <div className="bento">
      {/* ---------- CARD 1: copy + CTA ---------- */}
      <div className="bento-card b-text">
        <div className="b-grid-bg" aria-hidden />
        <div className="b-sheen" aria-hidden />
        <span className="b-kicker">The outcome</span>
        <h3 className="b-text-title">Ship fixes while you sleep.</h3>
        <p className="b-text-desc">
          Kubric triages, root-causes, and patches the boring 80% of incidents — before anyone gets paged.
        </p>
        <button
          className="btn btn-primary lg"
          onClick={(e) => {
            e.preventDefault();
            router.push('/login');
          }}
        >
          Start free <span className="arrow">→</span>
        </button>
        <div className="b-ministats">
          <div className="b-ministat">
            <span className="b-ministat-v">&lt;5m</span>
            <span className="b-ministat-k">target MTTR</span>
          </div>
          <div className="b-ministat-div" />
          <div className="b-ministat">
            <span className="b-ministat-v">80%</span>
            <span className="b-ministat-k">predicted preventable</span>
          </div>
          <div className="b-ministat-div" />
          <div className="b-ministat">
            <span className="b-ministat-v b-ok">₹0</span>
            <span className="b-ministat-k">free under 10 nodes</span>
          </div>
        </div>
      </div>

      {/* ---------- CARD 2: MTTR analytics chart ---------- */}
      <div className="bento-card b-chart">
        <div className="b-chart-head">
          <div>
            <div className="b-chart-label">Mean time to resolution</div>
            <div className="b-chart-stat">43 min <span className="arrow-g">→</span> &lt; 5 min</div>
          </div>
          <span className="b-chip">TARGET · NOT YET MEASURED</span>
        </div>
        <svg className="b-chart-svg" viewBox="0 0 420 195">
          <defs>
            <linearGradient id="b-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(124,255,178,0.30)" />
              <stop offset="100%" stopColor="rgba(124,255,178,0)" />
            </linearGradient>
            <filter id="b-lineglow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* y grid + labels */}
          {[
            { y: 30, l: '43m' },
            { y: 90, l: '20m' },
            { y: 150, l: '5m' },
          ].map((g) => (
            <g key={g.l}>
              <line x1="42" y1={g.y} x2="400" y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 6" />
              <text x="30" y={g.y + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.32)" fontFamily="var(--font-jetbrains-mono), monospace">{g.l}</text>
            </g>
          ))}
          {/* vertical guide to latest point */}
          <line className="b-guide" x1="400" y1="158" x2="400" y2="172" stroke="rgba(124,255,178,0.4)" strokeWidth="1" strokeDasharray="2 3" />
          <path className="b-area-path" d={area} fill="url(#b-area)" />
          <path className="b-line-path" d={line} fill="none" stroke="#7cffb2" strokeWidth="2" strokeLinecap="round" filter="url(#b-lineglow)" />
          <circle className="b-travel" r="4" fill="#7cffb2" style={{ offsetPath: `path("${line}")` } as React.CSSProperties} />
          {CHART_PTS.map((p, i) => (
            <circle key={i} className="b-pt" cx={p.x} cy={p.y} r="2.6" fill="#0b100d" stroke="#7cffb2" strokeWidth="1.5" style={{ animationDelay: `${(i * 0.28).toFixed(2)}s` }} />
          ))}
          {/* latest node + callout */}
          <circle className="b-pt-live" cx="400" cy="158" r="5" fill="#7cffb2" />
          <g className="b-callout">
            <rect x="336" y="126" width="66" height="22" fill="rgba(124,255,178,0.12)" stroke="rgba(124,255,178,0.4)" strokeWidth="0.75" />
            <text x="369" y="141" textAnchor="middle" fontSize="10" fontWeight="600" fill="#7cffb2" fontFamily="var(--font-jetbrains-mono), monospace">&lt; 5 min</text>
          </g>
        </svg>
        <div className="b-chart-x"><span>Industry baseline*</span><span></span><span></span><span></span><span></span><span>Kubric target</span></div>
      </div>

      {/* ---------- CARD 3: radar — every cluster watched ---------- */}
      <div className="bento-card b-orbit">
        <div className="b-orbit-copy">
          <span className="b-kicker">Always on</span>
          <h4 className="b-orbit-title">Every cluster, watched.</h4>
        </div>
        <svg className="b-orbit-svg" viewBox="0 0 320 220" role="img" aria-label="Kubric watching many clusters">
          <defs>
            <radialGradient id="b-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(124,255,178,0.5)" />
              <stop offset="70%" stopColor="rgba(124,255,178,0)" />
            </radialGradient>
            <linearGradient id="b-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(124,255,178,0.28)" />
              <stop offset="100%" stopColor="rgba(124,255,178,0)" />
            </linearGradient>
          </defs>
          {/* concentric rings with tick marks */}
          {[100, 68, 38].map((r) => (
            <circle key={r} cx="160" cy="110" r={r} fill="none" stroke="rgba(124,255,178,0.12)" strokeWidth="1" />
          ))}
          <circle cx="160" cy="110" r="100" fill="none" stroke="rgba(124,255,178,0.16)" strokeWidth="1" strokeDasharray="1 9" />
          {/* rotating radar sweep */}
          <g className="b-sweep" style={{ transformBox: 'view-box', transformOrigin: '160px 110px' }}>
            <path d="M160 110 L160 10 A100 100 0 0 1 247 60 Z" fill="url(#b-sweep)" />
          </g>
          {/* connection lines */}
          <g stroke="rgba(124,255,178,0.14)" strokeWidth="1">
            <line x1="160" y1="110" x2="160" y2="40" />
            <line x1="160" y1="110" x2="242" y2="150" />
            <line x1="160" y1="110" x2="78" y2="150" />
            <line x1="160" y1="110" x2="230" y2="66" />
          </g>
          {/* cluster nodes */}
          {[
            { x: 160, y: 40, l: 'eks-1', bad: false },
            { x: 242, y: 150, l: 'gke-2', bad: false },
            { x: 78, y: 150, l: 'aks-3', bad: true },
            { x: 230, y: 66, l: 'eks-4', bad: false },
          ].map((n) => (
            <g key={n.l} className={n.bad ? 'b-node bad' : 'b-node'}>
              <circle cx={n.x} cy={n.y} r="9" fill="rgba(10,15,12,0.9)" stroke={n.bad ? 'rgba(255,107,107,0.7)' : 'rgba(124,255,178,0.5)'} strokeWidth="1.2" />
              <circle cx={n.x} cy={n.y} r="3" fill={n.bad ? '#ff6b6b' : '#7cffb2'} />
              <text x={n.x} y={n.y + 22} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.4)" fontFamily="var(--font-jetbrains-mono), monospace">{n.l}</text>
            </g>
          ))}
          {/* core */}
          <circle cx="160" cy="110" r="34" fill="url(#b-glow)" className="b-orbit-core" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <circle cx="160" cy="110" r="20" fill="rgba(6,10,8,0.9)" stroke="rgba(124,255,178,0.45)" strokeWidth="1" />
          <image href="/kubric-logo.png" x="144" y="94" width="32" height="32" style={{ filter: 'drop-shadow(0 0 5px rgba(124,255,178,0.6))' }} />
        </svg>
        <span className="b-orbit-cap">14 clusters · 1 agent · 0 to babysit</span>
      </div>

      {/* ---------- CARD 4: live agent diagnostic ---------- */}
      <div className="bento-card b-ui">
        <div className="b-ui-bar">
          <span className="b-ui-dot" /><span className="b-ui-dot" /><span className="b-ui-dot" />
          <span className="b-ui-title">kubric · prod-us-east</span>
          <span className="b-ui-live"><span className="b-ui-livedot" /> investigating</span>
        </div>
        <div className="b-ui-body">
          <div className="b-trace">
            <span className="b-trace-spine" />
            <span className="b-trace-fill" style={{ height: fillPct }} />
            {TRACE.map((n, i) => {
              const done = phase >= i;
              const glyph = n.verdict ? '✓' : n.bad ? '!' : '●';
              return (
                <div key={n.title} className={`b-trace-row ${done ? 'done' : ''} ${n.bad ? 'bad' : ''} ${n.verdict ? 'verdict' : ''}`}>
                  <span className="b-trace-node">{done ? glyph : ''}</span>
                  <div className="b-trace-content">
                    <div className="b-trace-head">
                      <span className="b-trace-time">{n.t}</span>
                      <span className="b-trace-title">{n.title}</span>
                      {n.badge && done && <span className="b-ui-badge">{n.badge}</span>}
                    </div>
                    {n.verdict ? (
                      <div className={`b-trace-sub ${resultOpen ? 'show' : ''}`}>payment-svc · image tag <b>v2.9</b> not found</div>
                    ) : (
                      n.sub && <div className="b-trace-sub show">{n.sub}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`b-ui-cmd-wrap ${resultOpen ? 'open' : ''}`}>
            <div className="b-ui-cmd">
              <span className="b-ui-prompt">$</span> kubectl set image deploy/payment-svc app=payment:v2.8
              <span className="b-ui-cursor" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bento { display: grid; grid-template-columns: 2fr 3fr; gap: 16px; }
        .bento-card { position: relative; overflow: hidden; background: #0b100d; border: 0.5px solid rgba(124,255,178,0.14); padding: 26px; transition: border-color .3s ease; }
        .bento-card:hover { border-color: rgba(124,255,178,0.34); }
        .b-kicker { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #7cffb2; }

        /* card 1 */
        .b-text { display: flex; flex-direction: column; align-items: flex-start; gap: 13px; justify-content: center; }
        .b-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(124,255,178,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(124,255,178,0.045) 1px, transparent 1px); background-size: 26px 26px; mask-image: radial-gradient(circle at 75% 30%, #000 0%, transparent 70%); pointer-events: none; }
        .b-sheen { position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(100deg, transparent, rgba(124,255,178,0.06), transparent); animation: b-sheen 6s ease-in-out infinite; pointer-events: none; }
        @keyframes b-sheen { 0%{ left:-60% } 55%,100%{ left:130% } }
        .b-text-title { font-size: 30px; font-weight: 600; line-height: 1.1; color: #eef2f5; margin: 3px 0 0; letter-spacing: -0.01em; position: relative; }
        .b-text-desc { font-size: 14.5px; line-height: 1.6; color: rgba(255,255,255,0.52); margin: 0; max-width: 330px; position: relative; }
        .b-text .btn { margin-top: 4px; position: relative; }
        .b-ministats { display: flex; align-items: center; gap: 16px; margin-top: 12px; padding-top: 18px; border-top: 0.5px solid rgba(255,255,255,0.07); width: 100%; position: relative; }
        .b-ministat { display: flex; flex-direction: column; gap: 2px; }
        .b-ministat-v { font-size: 20px; font-weight: 700; color: #eef2f5; font-family: var(--font-jetbrains-mono), monospace; }
        .b-ministat-v.b-ok { color: #7cffb2; }
        .b-ministat-k { font-size: 10.5px; color: rgba(255,255,255,0.4); }
        .b-ministat-div { width: 0.5px; height: 30px; background: rgba(255,255,255,0.1); }

        /* card 2 chart */
        .b-chart { display: flex; flex-direction: column; }
        .b-chart-head { display: flex; align-items: flex-start; justify-content: space-between; }
        .b-chart-label { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: rgba(255,255,255,0.4); }
        .b-chart-stat { font-size: 22px; font-weight: 600; color: #eef2f5; margin-top: 4px; }
        .arrow-g { color: #7cffb2; }
        .b-chip { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: #7cffb2; background: rgba(124,255,178,0.1); border: 0.5px solid rgba(124,255,178,0.28); padding: 4px 9px; }
        .b-chart-svg { width: 100%; height: 165px; margin-top: 14px; overflow: visible; }
        .b-area-path { opacity: 0; animation: b-fadein 1.5s ease 0.5s forwards; }
        .b-line-path { stroke-dasharray: 900; stroke-dashoffset: 900; animation: b-draw 6s ease-in-out infinite; }
        .b-travel { offset-distance: 0%; animation: b-move 6s ease-in-out infinite; }
        .b-pt { opacity: 0; animation: b-ptin 6s ease-in-out infinite; }
        .b-pt-live { opacity: 0; animation: b-livept 6s ease-in-out infinite; }
        .b-callout { opacity: 0; animation: b-callout 6s ease-in-out infinite; }
        .b-guide { opacity: 0; animation: b-callout 6s ease-in-out infinite; }
        @keyframes b-draw { 0%{stroke-dashoffset:900} 42%{stroke-dashoffset:0} 100%{stroke-dashoffset:0} }
        @keyframes b-move { 0%{offset-distance:0%;opacity:0} 6%{opacity:1} 42%{offset-distance:100%;opacity:1} 50%{opacity:0} 100%{offset-distance:100%;opacity:0} }
        @keyframes b-ptin { 0%,8%{opacity:0} 42%{opacity:1} 100%{opacity:1} }
        @keyframes b-livept { 0%,42%{opacity:0; r:5} 50%{opacity:1} 75%{opacity:1} 100%{opacity:1} }
        @keyframes b-callout { 0%,45%{opacity:0; transform: translateY(4px)} 55%,95%{opacity:1; transform: translateY(0)} 100%{opacity:0} }
        @keyframes b-fadein { to { opacity:1 } }
        .b-pt-live { animation-name: b-liveptpulse, b-livept; }
        @keyframes b-liveptpulse { 0%,100%{ filter: drop-shadow(0 0 0 rgba(124,255,178,0)) } 50%{ filter: drop-shadow(0 0 6px rgba(124,255,178,0.9)) } }
        .b-chart-x { display: flex; justify-content: space-between; font-family: var(--font-jetbrains-mono), monospace; font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 10px; padding-left: 20px; }

        /* card 3 radar */
        .b-orbit { display: flex; flex-direction: column; }
        .b-orbit-copy { display: flex; flex-direction: column; gap: 6px; }
        .b-orbit-title { font-size: 20px; font-weight: 600; color: #eef2f5; margin: 0; }
        .b-orbit-svg { width: 100%; height: 210px; margin: 2px 0; }
        .b-sweep { animation: b-spin 6s linear infinite; }
        .b-orbit-core { animation: b-pulse 3.5s ease-in-out infinite; }
        .b-node.bad circle:nth-child(2) { animation: b-badpulse 1.3s ease-in-out infinite; }
        @keyframes b-spin { to { transform: rotate(360deg); } }
        @keyframes b-pulse { 0%,100%{ transform: scale(1); opacity:.8 } 50%{ transform: scale(1.14); opacity:1 } }
        @keyframes b-badpulse { 0%,100%{ opacity:.45 } 50%{ opacity:1 } }
        .b-orbit-cap { font-family: var(--font-jetbrains-mono), monospace; font-size: 10.5px; color: rgba(255,255,255,0.35); }

        /* card 4 ui */
        .b-ui { padding: 0; display: flex; flex-direction: column; }
        .b-ui-bar { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 0.5px solid rgba(255,255,255,0.07); }
        .b-ui-dot { width: 8px; height: 8px; background: rgba(255,255,255,0.14); }
        .b-ui-dot:first-child { background: rgba(124,255,178,0.5); }
        .b-ui-title { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: rgba(255,255,255,0.4); margin-left: 6px; }
        .b-ui-live { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-jetbrains-mono), monospace; font-size: 10px; color: #7cffb2; }
        .b-ui-livedot { width: 6px; height: 6px; background: #7cffb2; box-shadow: 0 0 6px #7cffb2; animation: b-badpulse 1.5s ease-in-out infinite; }
        .b-ui-body { padding: 22px 18px; display: flex; flex-direction: column; gap: 16px; flex: 1; justify-content: center; }
        .b-trace { position: relative; padding-left: 30px; display: flex; flex-direction: column; gap: 16px; }
        .b-trace-spine { position: absolute; left: 8px; top: 8px; bottom: 8px; width: 1.5px; background: rgba(255,255,255,0.1); }
        .b-trace-fill { position: absolute; left: 8px; top: 8px; width: 1.5px; background: #7cffb2; box-shadow: 0 0 8px rgba(124,255,178,0.5); transition: height .5s ease; }
        .b-trace-row { position: relative; }
        .b-trace-node { position: absolute; left: -30px; top: 0; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; background: #0b100d; border: 1px solid rgba(255,255,255,0.15); color: #7cffb2; font-size: 10px; line-height: 1; transition: all .35s ease; }
        .b-trace-row.done .b-trace-node { border-color: rgba(124,255,178,0.55); box-shadow: 0 0 9px rgba(124,255,178,0.3); }
        .b-trace-row.bad.done .b-trace-node { border-color: rgba(255,107,107,0.6); color: #ff6b6b; }
        .b-trace-head { display: flex; align-items: center; gap: 9px; }
        .b-trace-time { font-family: var(--font-jetbrains-mono), monospace; font-size: 10px; color: rgba(255,255,255,0.3); }
        .b-trace-title { font-size: 12.5px; color: rgba(255,255,255,0.35); transition: color .35s ease; }
        .b-trace-row.done .b-trace-title { color: #eef2f5; }
        .b-trace-sub { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 3px; opacity: 0; transition: opacity .4s ease; }
        .b-trace-sub.show { opacity: 1; }
        .b-trace-sub b { color: #ff9b9b; font-weight: 600; }
        .b-trace-row.verdict .b-trace-title { font-weight: 600; }
        .b-ui-badge { font-family: var(--font-jetbrains-mono), monospace; font-size: 9.5px; color: #ff6b6b; border: 0.5px solid rgba(255,107,107,0.4); padding: 3px 7px; white-space: nowrap; }
        .b-ui-cmd-wrap { max-height: 0; opacity: 0; overflow: hidden; transition: max-height .5s ease, opacity .4s ease; }
        .b-ui-cmd-wrap.open { max-height: 60px; opacity: 1; }
        .b-ui-cmd { font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.35); border: 0.5px solid rgba(124,255,178,0.2); padding: 10px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .b-ui-prompt { color: #7cffb2; margin-right: 6px; }
        .b-ui-cursor { display: inline-block; width: 6px; height: 12px; background: #7cffb2; margin-left: 3px; vertical-align: middle; animation: b-blink 1s step-end infinite; }
        @keyframes b-blink { 0%,100%{ opacity:1 } 50%{ opacity:0 } }

        @media (max-width: 820px) { .bento { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) {
          .b-sheen, .b-line-path, .b-travel, .b-pt, .b-pt-live, .b-callout, .b-guide, .b-area-path, .b-sweep, .b-orbit-core, .b-node.bad circle, .b-ui-livedot, .b-spin, .b-ui-cursor { animation: none; }
          .b-area-path, .b-pt, .b-pt-live, .b-callout, .b-guide { opacity: 1; } .b-line-path { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
