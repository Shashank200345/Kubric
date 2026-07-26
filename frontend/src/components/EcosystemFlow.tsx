'use client';

import { useState } from 'react';

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

const FEATURES_LEFT = ['OOM Detection', 'Crash Diagnosis', 'Auto-Remediation'];
const FEATURES_RIGHT = ['Event Triage', 'Root Cause AI'];

/* ---- Official brand marks (Simple Icons, single-path, currentColor) ---- */
function KubernetesLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Kubernetes">
      <path d="M10.204 14.35l.007.01-.999 2.413a5.171 5.171 0 0 1-2.075-2.597l2.578-.437.004.005a.44.44 0 0 1 .484.606zm-.833-2.129a.44.44 0 0 0 .173-.756l.002-.011L7.585 9.7a5.143 5.143 0 0 0-.73 3.255l2.514-.725.002-.009zm1.145-1.98a.44.44 0 0 0 .699-.337l.01-.005.15-2.62a5.144 5.144 0 0 0-3.01 1.442l2.147 1.523.004-.002zm.76 2.75l.723.349.722-.347.18-.78-.5-.623h-.804l-.5.623.179.779zm1.5-3.095a.44.44 0 0 0 .7.336l.008.003 2.134-1.513a5.188 5.188 0 0 0-2.992-1.442l.148 2.615.002.001zm10.876 5.97l-5.773 7.181a1.6 1.6 0 0 1-1.248.594l-9.261.003a1.6 1.6 0 0 1-1.247-.596l-5.776-7.18a1.583 1.583 0 0 1-.307-1.34L2.1 5.573c.108-.47.425-.864.863-1.073L11.305.513a1.606 1.606 0 0 1 1.385 0l8.345 3.985c.438.209.755.604.863 1.073l2.062 8.955c.108.47-.005.963-.308 1.34zm-3.289-2.057c-.042-.01-.103-.026-.145-.034-.174-.033-.315-.025-.479-.038-.35-.037-.638-.067-.895-.148-.105-.04-.18-.165-.216-.216l-.201-.059a6.45 6.45 0 0 0-.105-2.332 6.465 6.465 0 0 0-.936-2.163c.052-.047.15-.133.177-.159.008-.09.001-.183.094-.282.197-.185.444-.338.743-.522.142-.084.273-.137.415-.242.032-.024.076-.062.11-.089.24-.191.295-.52.123-.736-.172-.216-.506-.236-.745-.045-.034.027-.08.062-.111.088-.134.116-.217.23-.33.35-.246.25-.45.458-.673.609-.097.056-.239.037-.303.033l-.19.135a6.545 6.545 0 0 0-4.146-2.003l-.012-.223c-.065-.062-.143-.115-.163-.25-.022-.268.015-.557.057-.905.023-.163.061-.298.068-.475.001-.04-.001-.099-.001-.142 0-.306-.224-.555-.5-.555-.275 0-.499.249-.499.555l.001.014c0 .041-.002.092 0 .128.006.177.044.312.067.475.042.348.078.637.056.906a.545.545 0 0 1-.162.258l-.012.211a6.424 6.424 0 0 0-4.166 2.003 8.373 8.373 0 0 1-.18-.128c-.09.012-.18.04-.297-.029-.223-.15-.427-.358-.673-.608-.113-.12-.195-.234-.329-.349-.03-.026-.077-.062-.111-.088a.594.594 0 0 0-.348-.132.481.481 0 0 0-.398.176c-.172.216-.117.546.123.737l.007.005.104.083c.142.105.272.159.414.242.299.185.546.338.743.522.076.082.09.226.1.288l.16.143a6.462 6.462 0 0 0-1.02 4.506l-.208.06c-.055.072-.133.184-.215.217-.257.081-.546.11-.895.147-.164.014-.305.006-.48.039-.037.007-.09.02-.133.03l-.004.002-.007.002c-.295.071-.484.342-.423.608.061.267.349.429.645.365l.007-.001.01-.003.129-.029c.17-.046.294-.113.448-.172.33-.118.604-.217.87-.256.112-.009.23.069.288.101l.217-.037a6.5 6.5 0 0 0 2.88 3.596l-.09.218c.033.084.069.199.044.282-.097.252-.263.517-.452.813-.091.136-.185.242-.268.399-.02.037-.045.095-.064.134-.128.275-.034.591.213.71.248.12.556-.007.69-.282v-.002c.02-.039.046-.09.062-.127.07-.162.094-.301.144-.458.132-.332.205-.68.387-.897.05-.06.13-.082.215-.105l.113-.205a6.453 6.453 0 0 0 4.609.012l.106.192c.086.028.18.042.256.155.136.232.229.507.342.84.05.156.074.295.145.457.016.037.043.09.062.129.133.276.442.402.69.282.247-.118.341-.435.213-.71-.02-.039-.045-.096-.065-.134-.083-.156-.177-.261-.268-.398-.19-.296-.346-.541-.443-.793-.04-.13.007-.21.038-.294-.018-.022-.059-.144-.083-.202a6.499 6.499 0 0 0 2.88-3.622c.064.01.176.03.213.038.075-.05.144-.114.28-.104.266.039.54.138.87.256.154.06.277.128.448.173.036.01.088.019.13.028l.009.003.007.001c.297.064.584-.098.645-.365.06-.266-.128-.537-.423-.608zM16.4 9.701l-1.95 1.746v.005a.44.44 0 0 0 .173.757l.003.01 2.526.728a5.199 5.199 0 0 0-.108-1.674A5.208 5.208 0 0 0 16.4 9.7zm-4.013 5.325a.437.437 0 0 0-.404-.232.44.44 0 0 0-.372.233h-.002l-1.268 2.292a5.164 5.164 0 0 0 3.326.003l-1.27-2.296h-.01zm1.888-1.293a.44.44 0 0 0-.27.036.44.44 0 0 0-.214.572l-.003.004 1.01 2.438a5.15 5.15 0 0 0 2.081-2.615l-2.6-.44-.004.005z" />
    </svg>
  );
}
function HelmLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Helm">
      <path d="M12.337 0c-.475 0-.861 1.016-.861 2.269 0 .527.069 1.011.183 1.396a8.514 8.514 0 0 0-3.961 1.22 5.229 5.229 0 0 0-.595-1.093c-.606-.866-1.34-1.436-1.79-1.43a.381.381 0 0 0-.217.066c-.39.273-.123 1.326.596 2.353.267.381.559.705.84.948a8.683 8.683 0 0 0-1.528 1.716h1.734a7.179 7.179 0 0 1 5.381-2.421 7.18 7.18 0 0 1 5.382 2.42h1.733a8.687 8.687 0 0 0-1.32-1.53c.35-.249.735-.643 1.078-1.133.719-1.027.986-2.08.596-2.353a.382.382 0 0 0-.217-.065c-.45-.007-1.184.563-1.79 1.43a4.897 4.897 0 0 0-.676 1.325 8.52 8.52 0 0 0-3.899-1.42c.12-.39.193-.887.193-1.429 0-1.253-.386-2.269-.862-2.269zM1.624 9.443v5.162h1.358v-1.968h1.64v1.968h1.357V9.443H4.62v1.838H2.98V9.443zm5.912 0v5.162h3.21v-1.108H8.893v-.95h1.64v-1.142h-1.64v-.84h1.853V9.443zm4.698 0v5.162h3.218v-1.362h-1.86v-3.8zm4.706 0v5.162h1.364v-2.643l1.357 1.225 1.35-1.232v2.65h1.365V9.443h-.614l-2.1 1.914-2.109-1.914zm-11.82 7.28a8.688 8.688 0 0 0 1.412 1.548 5.206 5.206 0 0 0-.841.948c-.719 1.027-.985 2.08-.596 2.353.39.273 1.289-.338 2.007-1.364a5.23 5.23 0 0 0 .595-1.092 8.514 8.514 0 0 0 3.961 1.219 5.01 5.01 0 0 0-.183 1.396c0 1.253.386 2.269.861 2.269.476 0 .862-1.016.862-2.269 0-.542-.072-1.04-.193-1.43a8.52 8.52 0 0 0 3.9-1.42c.121.4.352.865.675 1.327.719 1.026 1.617 1.637 2.007 1.364.39-.273.123-1.326-.596-2.353-.343-.49-.727-.885-1.077-1.135a8.69 8.69 0 0 0 1.202-1.36h-1.771a7.174 7.174 0 0 1-5.227 2.252 7.174 7.174 0 0 1-5.226-2.252z" />
    </svg>
  );
}
function PrometheusLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Prometheus">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.628-5.373-12-12-12zm0 22.46c-1.885 0-3.414-1.26-3.414-2.814h6.828c0 1.553-1.528 2.813-3.414 2.813zm5.64-3.745H6.36v-2.046h11.28v2.046zm-.04-3.098H6.391c-.037-.043-.075-.086-.111-.13-1.155-1.401-1.427-2.133-1.69-2.879-.005-.025 1.4.287 2.395.511 0 0 .513.119 1.262.255-.72-.843-1.147-1.915-1.147-3.01 0-2.406 1.845-4.508 1.18-6.207.648.053 1.34 1.367 1.387 3.422.689-.951.977-2.69.977-3.755 0-1.103.727-2.385 1.454-2.429-.648 1.069.168 1.984.894 4.256.272.854.237 2.29.447 3.201.07-1.892.395-4.652 1.595-5.605-.529 1.2.079 2.702.494 3.424.671 1.164 1.078 2.047 1.078 3.716a4.642 4.642 0 01-1.11 2.996c.792-.149 1.34-.283 1.34-.283l2.573-.502s-.374 1.538-1.81 3.019z" />
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
  { logo: <KubernetesLogo />, label: 'Kubernetes', detail: 'Reads pod, node & deployment state across every namespace.', cx: 754, cy: 106, soon: false },
  { logo: <HelmLogo />,       label: 'Helm',       detail: 'Release, values & rollout-history inspection is on the roadmap.', cx: 754, cy: 240, soon: true },
  { logo: <PrometheusLogo />, label: 'Prometheus', detail: 'Metrics & alert correlation is on the roadmap.', cx: 754, cy: 374, soon: true },
];

const X = (n: number) => `${(n / 1024) * 100}%`;
const Y = (n: number) => `${(n / 480) * 100}%`;

export default function EcosystemFlow() {
  // Only Kubernetes is a live integration; Helm & Prometheus are on the roadmap.
  // Keep the live node highlighted rather than rotating through unbuilt ones.
  const [active] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  const current = hovered ?? active;
  // A provider's connector shows live flowing packets only when it's the
  // currently-highlighted node AND it's an actually-shipped integration.
  const liveGroup = PROVIDERS[current]?.soon ? -2 : current;

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
          font-family: var(--font-inter), system-ui, sans-serif;
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
        /* brand lockup — matches the navbar (logo mark + KUBRIC wordmark) */
        .eco-brand { display: flex; align-items: center; justify-content: center; gap: 0.15cqw; margin-bottom: 1.5cqw; }
        .eco-brand-logo { height: 4.2cqw; width: auto; display: block; flex-shrink: 0; transform: translateY(0.25cqw); }
        .eco-brand-name {
          font-family: "Fredoka", system-ui, sans-serif;
          font-weight: 600;
          font-size: 1.85cqw;
          line-height: 1;
          letter-spacing: 0.12em;
          color: #f4f7f9;
          display: inline-flex;
          align-items: center;
          transform: translateY(-0.07cqw);
        }
        .eco-brand-name .k { color: #7cffb2; }
        .eco-pills { display: grid; grid-template-columns: 1fr 1fr; gap: 1.3cqw; flex: 1; min-height: 0; }
        .eco-col { display: flex; flex-direction: column; justify-content: space-evenly; }
        .eco-pill {
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1cqw; font-weight: 500; line-height: 1; letter-spacing: -0.01em;
          padding: 1.3cqw 0.8cqw; border-radius: 0.75cqw; text-align: center; white-space: nowrap;
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
          display: flex; align-items: center; gap: 0.5cqw;
        }
        .eco-prov.act .eco-prov-label { color: #7cffb2; }

        /* roadmap (not-yet-shipped) providers: dimmed, no glow */
        .eco-prov.soon {
          opacity: 0.5;
          border-style: dashed;
          border-color: rgba(255,255,255,0.14);
          box-shadow: none;
          cursor: default;
        }
        .eco-prov.soon:hover { opacity: 0.72; }
        .eco-prov-soon {
          font-size: 0.75cqw; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
          color: #9aa3ad; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5cqw;
          padding: 0.15cqw 0.5cqw;
        }

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
          const flowOn = l.group === liveGroup || l.group === -1;
          return <use key={`w-${l.id}`} href={`#${l.id}`} className={`eco-wire ${flowOn ? 'act' : ''}`} />;
        })}
        {LINES.map(l => {
          const flowOn = l.group === liveGroup || l.group === -1;
          // Only shipped integrations get the animated data flow.
          if (!flowOn) return null;
          return <use key={`f-${l.id}`} href={`#${l.id}`} className="eco-flow act" />;
        })}
        {LINES.map(l => {
          const flowOn = l.group === liveGroup || l.group === -1;
          if (!flowOn) return null;
          return (
            <circle key={`p-${l.id}`} className="pkt act" r={3}>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="eco-brand-logo" src="/kubric-logo.png" alt="" />
          <span className="eco-brand-name">
            <span className="k">K</span>UBRIC
          </span>
        </div>
        <div className="eco-pills">
          <div className="eco-col">
            {FEATURES_LEFT.map((f, i) => (
              <span key={f} className="eco-pill" style={{ animationDelay: `${i * 0.07}s` }}>{f}</span>
            ))}
          </div>
          <div className="eco-col">
            {FEATURES_RIGHT.map((f, i) => (
              <span key={f} className="eco-pill" style={{ animationDelay: `${(i + 0.5) * 0.07}s` }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* provider nodes */}
      {PROVIDERS.map((p, i) => (
        <div
          key={p.label}
          className={`eco-prov ${current === i && !p.soon ? 'act' : ''} ${p.soon ? 'soon' : ''}`}
          style={{ left: X(p.cx), top: Y(p.cy) }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          {p.logo}
          <span className="eco-prov-label">
            {p.label}
            {p.soon && <span className="eco-prov-soon">Soon</span>}
          </span>
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
