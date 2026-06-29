'use client';

import { useEffect, useRef, useState } from 'react';

type Tok = { t: string; c?: string };
type Line = Tok[];

const INCIDENTS: { tag: string; lines: Line[] }[] = [
  {
    tag: 'CrashLoopBackOff',
    lines: [
      [{ t: '$ ', c: 'mut' }, { t: 'kubric diagnose ', c: 'cmd' }, { t: 'payment-svc -n payments' }],
      [{ t: '→ analyzing 23 restarts · 4 events · 312 log lines', c: 'mut' }],
      [],
      [{ t: '✓ root cause  ', c: 'ok' }, { t: 'OOMKilled', c: 'err' }, { t: ' — heap exceeds 128Mi' }],
      [{ t: '  fix         ', c: 'key' }, { t: 'set limits.memory=512Mi' }],
      [{ t: '  revert      ', c: 'key' }, { t: 'PR #2814 ', c: 'warn' }, { t: '(JsonCodec leak)' }],
      [],
      [{ t: '✓ applied · pod healthy in 12s', c: 'ok' }],
    ],
  },
  {
    tag: 'ImagePullBackOff',
    lines: [
      [{ t: '$ ', c: 'mut' }, { t: 'kubric diagnose ', c: 'cmd' }, { t: 'order-api -n orders' }],
      [{ t: '→ inspecting image pull + registry auth', c: 'mut' }],
      [],
      [{ t: '✓ root cause  ', c: 'ok' }, { t: 'registry token expired', c: 'err' }, { t: ' 5m ago' }],
      [{ t: '  fix         ', c: 'key' }, { t: 'refresh imagePullSecret' }],
      [{ t: '  action      ', c: 'key' }, { t: 'rollout restart deploy/order-api' }],
      [],
      [{ t: '✓ applied · image pulled in 6s', c: 'ok' }],
    ],
  },
  {
    tag: '5xx / DNS',
    lines: [
      [{ t: '$ ', c: 'mut' }, { t: 'kubric trace ', c: 'cmd' }, { t: 'checkout -n storefront' }],
      [{ t: '→ tracing 5xx across ingress · CNI · CoreDNS', c: 'mut' }],
      [],
      [{ t: '✓ root cause  ', c: 'ok' }, { t: 'CoreDNS NXDOMAIN', c: 'err' }, { t: ' — stale svc IP' }],
      [{ t: '  fix         ', c: 'key' }, { t: 'flush cache + restart coredns' }],
      [{ t: '  action      ', c: 'key' }, { t: 'rollout restart deploy/coredns' }],
      [],
      [{ t: '✓ applied · p99 latency normal', c: 'ok' }],
    ],
  },
];

// w = target width %, dur = fill time (s) — more time → longer + slower
const BENCH = [
  { label: 'Kubric', time: '0:34', w: 18, dur: 0.8, best: true },
  { label: 'Manual triage', time: '9:12', w: 52, dur: 1.1 },
  { label: 'Runbook lookup', time: '14:30', w: 74, dur: 1.3 },
  { label: 'On-call escalation', time: '22:05', w: 96, dur: 1.5 },
];

const TIMING = (() => {
  let acc = 0.35;
  return BENCH.map((r) => {
    const start = acc;
    const done = start + r.dur;
    acc = done + 0.2;
    return { start, done };
  });
})();
const SEQ_END = Math.max(...TIMING.map((t) => t.done));
const HOLD = 1.1;
const OUT_DUR = 0.45;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function ResolutionShowcase() {
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [widths, setWidths] = useState<number[]>(() => BENCH.map(() => 0));
  const [revealed, setRevealed] = useState<boolean[]>(() => BENCH.map(() => false));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let startTs: number | null = null;

    const loop = (ts: number) => {
      if (startTs === null) startTs = ts;
      const el = (ts - startTs) / 1000;

      if (phase === 'in') {
        setWidths(BENCH.map((b, i) => easeOut(Math.min(Math.max((el - TIMING[i].start) / b.dur, 0), 1)) * b.w));
        setRevealed(BENCH.map((_, i) => el >= TIMING[i].done - 0.02));
        if (el < SEQ_END + HOLD) rafRef.current = requestAnimationFrame(loop);
        else setPhase('out');
      } else {
        const k = 1 - easeOut(Math.min(el / OUT_DUR, 1));
        setWidths(BENCH.map((b) => b.w * k));
        if (el < OUT_DUR) rafRef.current = requestAnimationFrame(loop);
        else {
          setActive((a) => (a + 1) % INCIDENTS.length);
          setPhase('in');
        }
      }
    };

    if (phase === 'in') {
      setWidths(BENCH.map(() => 0));
      setRevealed(BENCH.map(() => false));
    } else {
      setRevealed(BENCH.map(() => false));
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, active]);

  const incident = INCIDENTS[active];

  return (
    <div className="rs-grid">
      <style>{`
        .rs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
          font-family: var(--font-thicccboi), system-ui, sans-serif;
        }
        .rs-card { display: flex; flex-direction: column; }
        .rs-term {
          position: relative;
          border: 1px solid rgba(124,255,178,0.14);
          background: linear-gradient(160deg, rgba(124,255,178,0.05), rgba(8,18,11,0.72));
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          box-shadow: 0 30px 70px -30px rgba(0,0,0,0.85), 0 0 50px -24px rgba(124,255,178,0.3);
          overflow: hidden;
        }
        .rs-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02);
        }
        .rs-dot { width: 10px; height: 10px; border-radius: 50% !important; }
        .rs-dot.r { background: #ff6058; }
        .rs-dot.y { background: #ffbd2e; }
        .rs-dot.g { background: #28c941; }
        .rs-bar-title { margin-left: 10px; font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--muted); }
        .rs-bar-tag {
          margin-left: auto; font-family: "JetBrains Mono", monospace;
          font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
          color: #7cffb2; border: 1px solid rgba(124,255,178,0.25);
          background: rgba(124,255,178,0.08); padding: 3px 9px;
        }
        .rs-body { padding: 20px 22px; font-family: "JetBrains Mono", monospace; font-size: 13px; line-height: 1.85; min-height: 248px; }

        /* left typewriter */
        .rs-codeline { display: flex; gap: 16px; white-space: pre; }
        .rs-ln { color: #3c4a40; user-select: none; min-width: 18px; text-align: right; }
        .rs-mut { color: #6b727b; }
        .rs-cmd { color: #7cffb2; }
        .rs-ok  { color: #7cffb2; }
        .rs-key { color: #7fd3ff; }
        .rs-warn{ color: #ffb86b; }
        .rs-err { color: #ff6b8a; }
        .rs-line-in { animation: rs-in 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .rs-line-out { animation: rs-out 0.42s cubic-bezier(0.55,0,0.85,0.3) both; }
        @keyframes rs-in {
          from { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateY(3px); }
          to   { opacity: 1; clip-path: inset(0 0 0 0); transform: none; }
        }
        @keyframes rs-out {
          from { opacity: 1; clip-path: inset(0 0 0 0); transform: none; }
          to   { opacity: 0; clip-path: inset(0 0 0 100%); transform: translateY(-2px); }
        }

        /* right benchmark — ALL block-level divs so width applies */
        .rs-bench { display: flex; flex-direction: column; gap: 18px; }
        .rs-row { display: grid; grid-template-columns: 150px 1fr 56px; align-items: center; gap: 14px; }
        .rs-label { display: flex; align-items: center; gap: 9px; font-family: "JetBrains Mono", monospace; font-size: 12.5px; color: var(--text); }
        .rs-label.dim { color: var(--muted); }
        .rs-status { width: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rs-pend { width: 8px; height: 8px; border-radius: 50% !important; background: #3c4a40; }
        .rs-check { color: #7cffb2; font-size: 13px; transition: opacity .3s ease, transform .4s cubic-bezier(0.34,1.56,0.64,1); }

        .rs-track { display: block; width: 100%; height: 8px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .rs-fill { display: block; height: 100%; }
        .rs-fill.best { background: linear-gradient(90deg, #3ddc84, #7cffb2 55%, #c4ffdd); box-shadow: 0 0 16px rgba(124,255,178,0.75); }
        .rs-fill.slow { background: linear-gradient(90deg, rgba(124,255,178,0.55), rgba(124,255,178,0.3)); }
        .rs-time { font-family: "JetBrains Mono", monospace; font-size: 12.5px; text-align: right; transition: opacity .35s ease; }
        .rs-time.best { color: #7cffb2; }
        .rs-time.slow { color: var(--muted); }

        /* caption */
        .rs-cap { padding: 20px 2px 0; }
        .rs-eyebrow { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #7cffb2; }
        .rs-cap h3 { margin: 12px 0 8px; font-size: clamp(20px, 2.4vw, 27px); font-weight: 600; letter-spacing: -0.01em; color: var(--text); }
        .rs-cap p { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.55; max-width: 42ch; }

        @media (max-width: 860px) {
          .rs-grid { grid-template-columns: 1fr; }
          .rs-row { grid-template-columns: 120px 1fr 50px; }
        }
      `}</style>

      {/* LEFT — incident diagnosis */}
      <figure className="rs-card">
        <div className="rs-term">
          <div className="rs-bar">
            <span className="rs-dot r" />
            <span className="rs-dot y" />
            <span className="rs-dot g" />
            <span className="rs-bar-title">kubric · diagnose</span>
            <span className="rs-bar-tag">{incident.tag}</span>
          </div>
          <div className="rs-body">
            {incident.lines.map((line, li) => {
              const n = incident.lines.length;
              const delay = phase === 'in' ? li * 0.07 : (n - 1 - li) * 0.05;
              return (
                <div className={`rs-codeline rs-line-${phase}`} key={li} style={{ animationDelay: `${delay}s` }}>
                  <span className="rs-ln">{String(li + 1).padStart(2, '0')}</span>
                  <span>
                    {line.length === 0
                      ? '\u00A0'
                      : line.map((tok, ti) => (
                          <span key={ti} className={tok.c ? `rs-${tok.c}` : undefined}>{tok.t}</span>
                        ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <figcaption className="rs-cap">
          <span className="rs-eyebrow">Autonomous diagnosis</span>
          <h3>Root cause and fix, in one pass.</h3>
          <p>Point Kubric at a failing workload — it reads the events, logs, and traces, names the cause, and ships the fix.</p>
        </figcaption>
      </figure>

      {/* RIGHT — sequential progress benchmark */}
      <figure className="rs-card">
        <div className="rs-term">
          <div className="rs-bar">
            <span className="rs-dot r" />
            <span className="rs-dot y" />
            <span className="rs-dot g" />
            <span className="rs-bar-title">Mean time to resolution</span>
          </div>
          <div className="rs-body rs-bench">
            {BENCH.map((row, ri) => (
              <div className="rs-row" key={row.label}>
                <div className={`rs-label ${row.best ? '' : 'dim'}`}>
                  <div className="rs-status">
                    {row.best ? (
                      <span className="rs-check" style={{ opacity: revealed[ri] ? 1 : 0, transform: revealed[ri] ? 'scale(1)' : 'scale(0.3)' }}>✓</span>
                    ) : (
                      <span className="rs-pend" />
                    )}
                  </div>
                  {row.label}
                </div>
                <div className="rs-track">
                  <div className={`rs-fill ${row.best ? 'best' : 'slow'}`} style={{ width: `${widths[ri]}%` }} />
                </div>
                <div className={`rs-time ${row.best ? 'best' : 'slow'}`} style={{ opacity: revealed[ri] ? 1 : 0 }}>
                  {row.time}
                </div>
              </div>
            ))}
          </div>
        </div>
        <figcaption className="rs-cap">
          <span className="rs-eyebrow">Built for speed</span>
          <h3>Minutes of triage, down to seconds.</h3>
          <p>Parallel inspectors and grounded reasoning collapse the path from alert to root cause — no paging, no runbook hunt.</p>
        </figcaption>
      </figure>
    </div>
  );
}
