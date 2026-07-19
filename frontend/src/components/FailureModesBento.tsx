'use client';

/**
 * omium.ai-style bento grid (3×2). Each card has a mono label, title,
 * description, and a console-style illustration panel with a dotted texture.
 * Re-imagined for Kubric — Kubernetes incident detection, classification, and fixes.
 */

export default function FailureModesBento() {
  return (
    <div className="fb">
      {/* ── Row 1 · Card 1 — Investigation trace (connected step list) ── */}
      <div className="fb-card">
        <div className="fb-label">Trace</div>
        <h3 className="fb-title">Autonomous investigation</h3>
        <p className="fb-desc">Kubric snapshots every signal it reads — pods, events, metrics — into one auditable run you can replay.</p>
        <div className="fb-panel">
          <div className="fb-phead">RUN · CLUSTER-PROD <span className="fb-live">● 6 signals</span></div>
          <div className="fb-steps">
            <span className="fb-step-line" />
            {[
              { fn: 'get_pods()', tag: 'KUBECTL' },
              { fn: 'watch_events()', tag: 'EVENTS' },
              { fn: 'branch: oom_check', tag: 'BRANCH' },
              { fn: 'top_pods()', tag: 'METRICS' },
              { fn: 'llm.analyze()', tag: 'AI' },
              { fn: 'suggest_fix()', tag: 'FIX' },
            ].map((s, i) => (
              <div className={`fb-step ${i === 0 ? 'active' : ''}`} key={s.fn}>
                <span className={`fb-step-node ${i === 0 ? 'active' : ''}`} style={{ animationDelay: `${i}s` }} />
                <span className="fb-step-txt" style={{ animationDelay: `${i}s` }}>{s.fn}</span>
                <span className="fb-step-tag">{s.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 1 · Card 2 — Classification (tagged incidents) ── */}
      <div className="fb-card">
        <div className="fb-label">Classification</div>
        <h3 className="fb-title">Failure classification</h3>
        <p className="fb-desc">Every incident auto-tagged by type, so you triage the right thing first — not a wall of noise.</p>
        <div className="fb-panel">
          <div className="fb-phead">INCIDENTS · auto-tagged <span className="fb-live">● classify</span></div>
          <div className="fb-rows">
            {[
              { g: '✕', name: 'payment-svc', n: '1.9k', tag: 'OOMKilled', t: 'crit' },
              { g: '✕', name: 'order-api', n: '312', tag: 'ImagePullBackOff', t: 'crit' },
              { g: '●', name: 'auth-svc', n: '28', tag: 'CrashLoopBackOff', t: 'crit' },
              { g: '▲', name: 'ingress-nginx', n: '14', tag: 'ProbeFailed', t: 'warn' },
              { g: '●', name: 'coredns', n: '5', tag: 'BackOff', t: 'warn' },
            ].map((r, i) => (
              <div className="fb-row fb-crow" key={r.name} style={{ animationDelay: `${i * 0.9}s` }}>
                <span className={`fb-glyph ${r.t}`}>{r.g}</span>
                <span className="fb-rname">{r.name}</span>
                <span className="fb-rnum">{r.n}</span>
                <span className={`fb-badge ${r.t}`} style={{ animationDelay: `${i * 0.9}s` }}>{r.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 1 · Card 3 — Fix suggestions (YAML diff) ── */}
      <div className="fb-card">
        <div className="fb-label">Fixes</div>
        <h3 className="fb-title">Fix suggestions</h3>
        <p className="fb-desc">Kubric finds the root cause and proposes the exact manifest change — not just another alert.</p>
        <div className="fb-panel">
          <div className="fb-phead">payment-svc.yaml <span className="fb-sug">SUGGESTED</span><span className="fb-applybtn">Apply fix ⌄</span></div>
          <div className="fb-code">
            <div className="fb-cl">  resources:</div>
            <div className="fb-cl">    limits:</div>
            <div className="fb-cl del">-     memory: 128Mi</div>
            <div className="fb-cl add">+     memory: 512Mi</div>
            <div className="fb-cl">    requests:</div>
            <div className="fb-cl">      memory: 256Mi</div>
            <div className="fb-cl dim"># prevents OOMKill seen 1.9k times</div>
          </div>
        </div>
      </div>

      {/* ── Row 2 · Card 4 — Incident timeline ── */}
      <div className="fb-card">
        <div className="fb-label">Timeline</div>
        <h3 className="fb-title">Incident timeline</h3>
        <p className="fb-desc">Every incident as one clean timeline — detected, root-caused, fixed, recovered.</p>
        <div className="fb-panel">
          <div className="fb-phead">TIMELINE · incident-4821 <span className="fb-live">resolved</span></div>
          <div className="fb-timeline">
            <div className="fb-tl-track">
              {['Detected', 'Analyzed', 'Fixed', 'Recovered'].map((s, i) => (
                <div className="fb-tl-node-wrap" key={s}>
                  <span className="fb-tl-node" style={{ animationDelay: `${i * 1}s` }} />
                  <span className="fb-tl-lbl">{s}</span>
                </div>
              ))}
              <span className="fb-tl-line" />
            </div>
            <div className="fb-tl-foot">MTTR 42s · autonomous</div>
          </div>
        </div>
      </div>

      {/* ── Row 2 · Card 5 — Signal correlation (span bars) ── */}
      <div className="fb-card">
        <div className="fb-label">Correlation</div>
        <h3 className="fb-title">Signal correlation</h3>
        <p className="fb-desc">Live signals from events, logs, metrics and probes for every workload. No sampling.</p>
        <div className="fb-panel">
          <div className="fb-phead">SIGNALS · payment-svc <span className="fb-live">● live</span></div>
          <div className="fb-spans">
            {[
              { k: 'events', w: 32, v: '18' },
              { k: 'logs', w: 88, v: '312' },
              { k: 'metrics', w: 60, v: 'P95' },
              { k: 'probes', w: 44, v: '3' },
              { k: 'restarts', w: 22, v: '7', crit: true },
            ].map((s, i) => (
              <div className="fb-span" key={s.k}>
                <span className="fb-span-k">{s.k}</span>
                <span className="fb-span-bar"><span className={`fb-span-fill ${s.crit ? 'crit' : ''}`} style={{ width: `${s.w}%`, animationDelay: `${i * 0.15}s` }} /></span>
                <span className="fb-span-v">{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2 · Card 6 — Pre-deploy PR risk ── */}
      <div className="fb-card">
        <div className="fb-label">PR Risk</div>
        <h3 className="fb-title">Pre-deploy PR risk</h3>
        <p className="fb-desc">Kubric checks the diff against live P95 usage and flags what will break — before merge.</p>
        <div className="fb-panel">
          <div className="fb-phead">PR #247 · payment-svc <span className="fb-risk">risk: high</span></div>
          <div className="fb-scrub">
            <span className="fb-scrub-line"><span className="fb-scrub-fill" /><span className="fb-scrub-knob" /></span>
            <div className="fb-scrub-marks"><span>diff</span><span>P95 check</span><span>verdict</span></div>
          </div>
          <div className="fb-io">
            <div className="fb-io-box"><div className="fb-io-k">INPUT</div><div className="fb-io-v">{'{ memory: 128Mi }'}</div></div>
            <div className="fb-io-box"><div className="fb-io-k">VERDICT</div><div className="fb-io-v crit">{'{ risk: "OOM likely" }'}</div></div>
          </div>
        </div>
      </div>

      <style>{`
        .fb { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 40px; }
        .fb-card {
          position: relative; overflow: hidden;
          background: #0a0f0c; border: 0.5px solid rgba(124,255,178,0.14);
          padding: 30px 28px 28px; display: flex; flex-direction: column;
          transition: border-color .3s ease;
        }
        .fb-card:hover { border-color: rgba(124,255,178,0.3); }
        /* subtle blueprint grid lines across the whole card, fading like a shadow */
        .fb-card::before {
          content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(124,255,178,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,255,178,0.05) 1px, transparent 1px);
          background-size: 34px 34px;
          -webkit-mask-image: radial-gradient(130% 90% at 50% 0%, #000 20%, transparent 82%);
          mask-image: radial-gradient(130% 90% at 50% 0%, #000 20%, transparent 82%);
        }
        /* faint dotted overlay for extra texture depth */
        .fb-card::after {
          content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image: radial-gradient(rgba(124,255,178,0.06) 0.5px, transparent 0.5px);
          background-size: 12px 12px;
          -webkit-mask-image: linear-gradient(160deg, #000 0%, transparent 60%);
          mask-image: linear-gradient(160deg, #000 0%, transparent 60%);
        }
        .fb-card > * { position: relative; z-index: 1; }
        .fb-label { font-family: var(--font-jetbrains-mono), monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.38); }
        .fb-title { font-size: 21px; font-weight: 600; color: #eef2f5; margin: 14px 0 9px; letter-spacing: -0.015em; }
        .fb-desc { font-size: 14.5px; line-height: 1.65; color: rgba(255,255,255,0.5); margin: 0 0 22px; min-height: 66px; }

        /* console illustration panel */
        .fb-panel {
          position: relative; z-index: 1; margin-top: auto;
          background: #0c1310; border: 0.5px solid rgba(255,255,255,0.1);
          padding: 14px; height: 248px; overflow: hidden;
          font-family: var(--font-jetbrains-mono), monospace;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        /* terminal title bar — full-width divider like the reference */
        .fb-phead {
          position: relative; display: flex; align-items: center; gap: 8px;
          font-size: 10px; letter-spacing: 0.1em; color: rgba(255,255,255,0.42); text-transform: uppercase;
          margin: -14px -14px 16px; padding: 12px 15px;
          border-bottom: 0.5px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
        }
        .fb-live { margin-left: auto; color: #7cffb2; }
        .fb-sug { margin-left: auto; color: #7cffb2; }
        .fb-risk { margin-left: auto; color: #ff6b6b; }
        .fb-applybtn { color: rgba(255,255,255,0.5); border: 0.5px solid rgba(255,255,255,0.14); padding: 2px 7px; margin-left: 8px; text-transform: none; letter-spacing: 0; }

        /* connected-node step list (reference: RUN · AGENT-42) */
        .fb-steps { position: relative; display: flex; flex-direction: column; gap: 13px; padding-left: 2px; }
        .fb-step-line { position: absolute; left: 7px; top: 9px; bottom: 9px; width: 1px; background: rgba(255,255,255,0.12); }
        .fb-step { position: relative; display: flex; align-items: center; gap: 13px; font-size: 12px; }
        .fb-step-node { position: relative; z-index: 1; width: 11px; height: 11px; flex-shrink: 0; border: 1.5px solid rgba(255,255,255,0.28); background: #0c1310; animation: fb-nodestep 6s linear infinite; }
        .fb-step-node.active { border-color: #7cffb2; box-shadow: 0 0 0 3px rgba(124,255,178,0.14), 0 0 10px rgba(124,255,178,0.6); }
        .fb-step-txt { flex: 1; color: rgba(255,255,255,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; animation: fb-txtstep 6s linear infinite; }
        .fb-step.active .fb-step-txt { color: #ffffff; font-weight: 600; }
        .fb-step-tag { font-size: 8.5px; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); border: 0.5px solid rgba(255,255,255,0.16); padding: 3px 9px; }
        @keyframes fb-nodestep {
          0%, 13% { border-color: #7cffb2; background: #7cffb2; box-shadow: 0 0 0 3px rgba(124,255,178,0.14), 0 0 10px rgba(124,255,178,0.6); }
          17%, 100% { border-color: rgba(255,255,255,0.28); background: #0c1310; box-shadow: none; }
        }
        @keyframes fb-txtstep {
          0%, 13% { color: #ffffff; font-weight: 600; }
          17%, 100% { color: rgba(255,255,255,0.5); font-weight: 400; }
        }
        /* classification row scan + badge pop (card 2) */
        .fb-crow { animation: fb-rowscan 4.5s ease-in-out infinite; }
        @keyframes fb-rowscan { 0%, 12% { background: rgba(124,255,178,0.05); } 18%, 100% { background: transparent; } }
        .fb-badge { animation: fb-badgepop 4.5s ease-in-out infinite; }
        @keyframes fb-badgepop { 0%, 12% { filter: brightness(1.4); transform: translateX(0); } 3% { transform: translateX(-2px); } 18%, 100% { filter: none; } }
        /* fix diff pulse + apply blink (card 3) */
        .fb-cl.del { animation: fb-delpulse 4s ease-in-out infinite; }
        @keyframes fb-delpulse { 0%, 42% { background: rgba(255,107,107,0.14); } 52%, 100% { background: rgba(255,107,107,0.06); } }
        .fb-cl.add { animation: fb-addpulse 4s ease-in-out infinite; }
        @keyframes fb-addpulse { 0%, 46% { background: rgba(124,255,178,0.07); } 56%, 90% { background: rgba(124,255,178,0.26); } 100% { background: rgba(124,255,178,0.07); } }
        .fb-applybtn { animation: fb-applyblink 4s ease-in-out infinite; }
        @keyframes fb-applyblink { 0%, 60% { border-color: rgba(255,255,255,0.14); color: rgba(255,255,255,0.5); } 70%, 88% { border-color: rgba(124,255,178,0.6); color: #7cffb2; } 100% { border-color: rgba(255,255,255,0.14); color: rgba(255,255,255,0.5); } }

        .fb-rows { position: relative; display: flex; flex-direction: column; gap: 8px; }
        .fb-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.72); }
        .fb-scanrow { animation: fb-scan 4s ease-in-out infinite; }
        @keyframes fb-scan { 0%,100% { background: transparent; } 50% { background: rgba(124,255,178,0.04); } }
        .fb-rdot { width: 6px; height: 6px; flex-shrink: 0; }
        .fb-rdot.crit { background: #ff6b6b; box-shadow: 0 0 6px rgba(255,107,107,0.8); }
        .fb-rdot.ok { background: #7cffb2; }
        .fb-glyph { width: 12px; text-align: center; flex-shrink: 0; }
        .fb-glyph.crit { color: #ff6b6b; } .fb-glyph.warn { color: #f5b544; }
        .fb-rname { flex: 1; color: #d4dbe2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fb-rnum { color: rgba(255,255,255,0.3); font-size: 10px; }
        .fb-tag, .fb-badge { font-size: 9px; padding: 2px 7px; white-space: nowrap; }
        .fb-tag.crit, .fb-badge.crit { color: #ff6b6b; background: rgba(255,107,107,0.1); border: 0.5px solid rgba(255,107,107,0.28); }
        .fb-tag.warn, .fb-badge.warn { color: #f5b544; background: rgba(245,181,68,0.1); border: 0.5px solid rgba(245,181,68,0.28); }
        .fb-tag.ok { color: #7cffb2; background: rgba(124,255,178,0.1); border: 0.5px solid rgba(124,255,178,0.28); }

        /* code diff */
        .fb-code { position: relative; display: flex; flex-direction: column; font-size: 10.5px; line-height: 1.7; color: rgba(255,255,255,0.6); }
        .fb-cl { padding: 0 6px; white-space: pre; }
        .fb-cl.del { background: rgba(255,107,107,0.12); color: #ff9b9b; }
        .fb-cl.add { background: rgba(124,255,178,0.12); color: #a8ffcf; }
        .fb-cl.dim { color: rgba(255,255,255,0.28); margin-top: 4px; }

        /* timeline — sequential stepping animation */
        .fb-timeline { position: relative; padding: 18px 4px 0; }
        .fb-tl-track { position: relative; display: flex; justify-content: space-between; }
        .fb-tl-line { position: absolute; top: 5px; left: 5%; right: 5%; height: 1.5px; background: rgba(124,255,178,0.2); z-index: 0; }
        .fb-tl-line::after {
          content: ""; position: absolute; top: 0; left: 0; height: 100%; width: 25%;
          background: #7cffb2; box-shadow: 0 0 10px #7cffb2;
          animation: fb-linefill 4s ease-in-out infinite;
        }
        @keyframes fb-linefill { 0% { width: 0%; } 25% { width: 33%; } 50% { width: 66%; } 75%,100% { width: 100%; } }
        .fb-tl-node-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .fb-tl-node { width: 11px; height: 11px; border: 1.5px solid rgba(124,255,178,0.4); background: #0b100d; animation: fb-nodefill 4s ease-in-out infinite; }
        @keyframes fb-nodefill {
          0%,100% { border-color: rgba(124,255,178,0.4); background: #0b100d; box-shadow: none; }
          12%,22% { border-color: #7cffb2; background: #7cffb2; box-shadow: 0 0 12px #7cffb2; }
          30% { border-color: rgba(124,255,178,0.4); background: #0b100d; box-shadow: none; }
        }
        .fb-tl-node.done { animation-fill-mode: forwards; }
        .fb-tl-lbl { font-size: 9px; color: rgba(255,255,255,0.45); }
        .fb-tl-foot { text-align: center; font-size: 9.5px; color: #7cffb2; margin-top: 20px; animation: fb-footfade 4s ease-in-out infinite; }
        @keyframes fb-footfade { 0%,70% { opacity: 0; } 80%,95% { opacity: 1; } 100% { opacity: 0; } }

        /* spans */
        .fb-spans { position: relative; display: flex; flex-direction: column; gap: 9px; }
        .fb-span { display: grid; grid-template-columns: 58px 1fr 30px; gap: 8px; align-items: center; font-size: 10px; color: rgba(255,255,255,0.55); }
        .fb-span-bar { height: 8px; background: rgba(255,255,255,0.05); }
        .fb-span-fill { display: block; height: 100%; background: #7cffb2; opacity: 0.85; animation: fb-grow 2.4s ease-in-out infinite alternate; transform-origin: left; }
        .fb-span-fill.crit { background: #ff6b6b; }
        @keyframes fb-grow { from { transform: scaleX(0.85); } to { transform: scaleX(1); } }
        .fb-span-v { color: rgba(255,255,255,0.4); text-align: right; }

        /* scrubber + io */
        .fb-scrub { position: relative; padding: 10px 2px 4px; }
        .fb-scrub-line { position: relative; display: block; height: 3px; background: rgba(255,255,255,0.08); }
        .fb-scrub-fill { position: absolute; left: 0; top: 0; height: 100%; width: 66%; background: #7cffb2; animation: fb-seek 4s ease-in-out infinite alternate; }
        .fb-scrub-knob { position: absolute; top: 50%; left: 66%; width: 10px; height: 10px; background: #7cffb2; box-shadow: 0 0 8px #7cffb2; transform: translate(-50%,-50%); animation: fb-seekknob 4s ease-in-out infinite alternate; }
        @keyframes fb-seek { from { width: 30%; } to { width: 82%; } }
        @keyframes fb-seekknob { from { left: 30%; } to { left: 82%; } }
        .fb-scrub-marks { display: flex; justify-content: space-between; font-size: 8.5px; color: rgba(255,255,255,0.3); margin-top: 8px; }
        .fb-io { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .fb-io-box { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.08); padding: 8px 9px; }
        .fb-io-k { font-size: 8.5px; color: rgba(255,255,255,0.3); letter-spacing: 0.06em; margin-bottom: 4px; }
        .fb-io-v { font-size: 10px; color: #d4dbe2; }
        .fb-io-v.crit { color: #ff9b9b; }

        @media (max-width: 940px) { .fb { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 620px) { .fb { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) {
          .fb-scanrow, .fb-tl-node, .fb-tl-line::after, .fb-tl-foot, .fb-span-fill, .fb-scrub-fill, .fb-scrub-knob,
          .fb-step-node, .fb-step-txt, .fb-crow, .fb-badge, .fb-cl.del, .fb-cl.add, .fb-applybtn { animation: none; }
        }
      `}</style>
    </div>
  );
}
