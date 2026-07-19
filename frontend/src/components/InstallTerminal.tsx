'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Animation script ─────────────────────────────────────────────────────────
// Each entry is either:
//   { type: 'cmd',    text: string }   → typed char-by-char with a $ prompt
//   { type: 'out',    text: string }   → printed instantly as output
//   { type: 'pause',  ms:   number }   → silent delay
// ─────────────────────────────────────────────────────────────────────────────
type CmdLine  = { type: 'cmd';   text: string };
type OutLine  = { type: 'out';   text: string; accent?: string };
type PauseLine = { type: 'pause'; ms: number };
type ScriptEntry = CmdLine | OutLine | PauseLine;

const SCRIPT: ScriptEntry[] = [
  { type: 'out',   text: '# Install the Kubric CLI' },
  { type: 'cmd',   text: 'curl -sSL https://get.kubric.dev | sh' },
  { type: 'pause', ms: 400 },
  { type: 'out',   text: '→ Downloading kubric for linux/amd64...' },
  { type: 'pause', ms: 600 },
  { type: 'out',   text: '✓ kubric installed to /usr/local/bin/kubric', accent: 'green' },
  { type: 'pause', ms: 500 },
  { type: 'out',   text: '' },
  { type: 'out',   text: '# Authenticate with your Kubric account' },
  { type: 'cmd',   text: 'kubric login' },
  { type: 'pause', ms: 400 },
  { type: 'out',   text: '→ Opening browser for authentication...' },
  { type: 'pause', ms: 700 },
  { type: 'out',   text: '✓ Logged in as you@company.com', accent: 'green' },
  { type: 'pause', ms: 500 },
  { type: 'out',   text: '' },
  { type: 'out',   text: '# Connect your cluster' },
  { type: 'cmd',   text: 'kubric connect' },
  { type: 'pause', ms: 400 },
  { type: 'out',   text: '→ Discovering Kubernetes clusters...' },
  { type: 'pause', ms: 500 },
  { type: 'out',   text: '→ Auto-selected cluster: prod-us-east' },
  { type: 'pause', ms: 400 },
  { type: 'out',   text: '→ Registering cluster with Kubric...' },
  { type: 'pause', ms: 600 },
  { type: 'out',   text: '→ Installing Kubric agent via Helm...' },
  { type: 'pause', ms: 800 },
  { type: 'out',   text: '' },
  { type: 'out',   text: '✓ Kubric is watching your cluster', accent: 'green' },
  { type: 'out',   text: '' },
  { type: 'out',   text: '  prod-us-east · synced 2s ago', accent: 'dim' },
  { type: 'out',   text: '  Health score: 98/100', accent: 'dim' },
  { type: 'out',   text: '  Active incidents: 0', accent: 'dim' },
  { type: 'out',   text: '  Pods: 42/42 running', accent: 'dim' },
];

type RenderedLine =
  | { kind: 'cmd'; full: string; typed: string; done: boolean }
  | { kind: 'out'; text: string; accent?: string }
  | { kind: 'cursor' };

const CHAR_DELAY = 38;   // ms per character
const RESTART_DELAY = 4000; // ms before loop

export default function InstallTerminal() {
  const [lines, setLines] = useState<RenderedLine[]>([]);
  const [running, setRunning] = useState(false);
  const bodyRef   = useRef<HTMLDivElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLines([]);
  }

  function delay(ms: number): Promise<void> {
    return new Promise(res => { timerRef.current = setTimeout(res, ms); });
  }

  async function run() {
    setRunning(true);
    setLines([{ kind: 'cursor' }]);

    for (const entry of SCRIPT) {
      if (entry.type === 'pause') {
        await delay(entry.ms);
        continue;
      }

      if (entry.type === 'out') {
        setLines(prev => {
          const without = prev.filter(l => l.kind !== 'cursor');
          return [...without, { kind: 'out', text: entry.text, accent: entry.accent }, { kind: 'cursor' }];
        });
        await delay(60);
        continue;
      }

      // cmd — type char by char
      const full = entry.text;
      setLines(prev => {
        const without = prev.filter(l => l.kind !== 'cursor');
        return [...without, { kind: 'cmd', full, typed: '', done: false }, { kind: 'cursor' }];
      });

      for (let i = 1; i <= full.length; i++) {
        await delay(CHAR_DELAY);
        setLines(prev => {
          const without = prev.filter(l => l.kind !== 'cursor');
          const updated = without.map(l =>
            l.kind === 'cmd' && !l.done ? { ...l, typed: full.slice(0, i) } : l
          );
          return [...updated, { kind: 'cursor' }];
        });
      }

      // mark cmd done (remove inline cursor for that line)
      setLines(prev => {
        const without = prev.filter(l => l.kind !== 'cursor');
        const updated = without.map(l =>
          l.kind === 'cmd' && !l.done ? { ...l, done: true } : l
        );
        return [...updated, { kind: 'cursor' }];
      });

      await delay(120);
    }

    // remove trailing cursor at end
    setLines(prev => prev.filter(l => l.kind !== 'cursor'));
    setRunning(false);

    // loop
    timerRef.current = setTimeout(() => {
      clear();
      run();
    }, RESTART_DELAY);
  }

  // auto-scroll inside terminal only — never touches page scroll
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  // start on mount
  useEffect(() => {
    run();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="it-wrap">
      {/* window chrome */}
      <div className="it-chrome">
        <span className="it-dot red" />
        <span className="it-dot yellow" />
        <span className="it-dot green-dot" />
        <span className="it-chrome-title">kubric — bash</span>
        {!running && (
          <button className="it-replay" onClick={() => { clear(); run(); }}>
            ↺ replay
          </button>
        )}
      </div>

      {/* terminal body — fixed height so page layout never shifts */}
      <div className="it-body" ref={bodyRef}>
        {lines.map((line, i) => {
          if (line.kind === 'cursor') {
            return <span key={i} className="it-cur" />;
          }
          if (line.kind === 'out') {
            return (
              <div key={i} className={`it-out ${line.accent ?? ''}`}>
                {line.text || '\u00a0'}
              </div>
            );
          }
          // cmd
          return (
            <div key={i} className="it-cmd-line">
              <span className="it-prompt">$</span>
              <span className="it-typed">{line.typed}</span>
              {!line.done && <span className="it-cur" />}
            </div>
          );
        })}
      </div>

      <style>{`
        .it-wrap {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          background: #050f08;
          border: 1px solid rgba(124,255,178,0.12);
          box-shadow: 0 0 60px rgba(124,255,178,0.06), 0 24px 64px rgba(0,0,0,0.6);
          overflow: hidden;
        }

        /* chrome bar */
        .it-chrome {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          background: #0a1a0f;
          border-bottom: 1px solid rgba(124,255,178,0.08);
        }
        .it-dot {
          width: 11px; height: 11px;
          border-radius: 50%;
          display: inline-block;
        }
        .it-dot.red       { background: #ff5f57; }
        .it-dot.yellow    { background: #febc2e; }
        .it-dot.green-dot { background: #28c840; }
        .it-chrome-title {
          flex: 1;
          text-align: center;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.04em;
        }
        .it-replay {
          background: none;
          border: 0.5px solid rgba(124,255,178,0.25);
          color: rgba(124,255,178,0.6);
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px;
          padding: 2px 8px;
          cursor: pointer;
          letter-spacing: 0.06em;
          transition: all .2s;
        }
        .it-replay:hover { color: #7cffb2; border-color: rgba(124,255,178,0.5); }

        /* body */
        .it-body {
          padding: 20px 24px 24px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 13px;
          line-height: 1.75;
          height: 360px;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        /* lines */
        .it-out       { color: rgba(255,255,255,0.55); white-space: pre; }
        .it-out.green { color: #7cffb2; }
        .it-out.dim   { color: rgba(255,255,255,0.35); }
        .it-out:has(> span:empty):empty { height: 1.75em; }

        .it-cmd-line  { display: flex; align-items: center; gap: 10px; }
        .it-prompt    { color: #7cffb2; user-select: none; }
        .it-typed     { color: rgba(255,255,255,0.92); white-space: pre; }

        /* blinking block cursor */
        .it-cur {
          display: inline-block;
          width: 8px; height: 15px;
          background: #7cffb2;
          opacity: 0.85;
          vertical-align: middle;
          animation: it-blink .9s step-end infinite;
          flex-shrink: 0;
        }
        @keyframes it-blink { 0%,100%{opacity:.85} 50%{opacity:0} }

        /* layout wrapper used in page.tsx */
        .it-section {
          padding: 72px 0 80px;
          border-top: 1px solid rgba(124,255,178,0.06);
        }
        .it-section-head {
          text-align: center;
          margin-bottom: 40px;
        }
        .it-section-kicker {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #7cffb2;
          margin-bottom: 12px;
        }
        .it-section-title {
          font-family: var(--font-lexend), system-ui, sans-serif;
          font-size: clamp(24px, 3.5vw, 42px);
          font-weight: 400;
          letter-spacing: -0.02em;
          color: #f4f7f9;
          margin: 0 0 14px;
          line-height: 1.1;
        }
        .it-section-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.45);
          max-width: 500px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}
