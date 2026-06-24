'use client';

import { useEffect, useRef, useState } from 'react';

interface Frame {
  text: string;
  className?: string;
  delay?: number;
  typeSpeed?: number;
}

// Only the animated part — from typing "y" onward
const ANIMATED_FRAMES: Frame[] = [
  // User types "y"
  { text: 'y', className: 'c-ok', delay: 1200, typeSpeed: 300 },
  { text: '\n\n', delay: 700, typeSpeed: 0 },
  // Applying
  { text: '→ applying fix…', className: 'c-mut', delay: 0, typeSpeed: 22 },
  { text: '\n', delay: 900, typeSpeed: 0 },
  { text: '  patching deployment/checkout-api ', className: 'c-mut', delay: 0, typeSpeed: 16 },
  { text: '✓', className: 'c-ok', delay: 400, typeSpeed: 0 },
  { text: '\n', delay: 200, typeSpeed: 0 },
  { text: '  reverting commit 8a3f2c1 ', className: 'c-mut', delay: 0, typeSpeed: 16 },
  { text: '✓', className: 'c-ok', delay: 400, typeSpeed: 0 },
  { text: '\n', delay: 200, typeSpeed: 0 },
  { text: '  rolling restart pods ', className: 'c-mut', delay: 0, typeSpeed: 16 },
  { text: '✓', className: 'c-ok', delay: 600, typeSpeed: 0 },
  { text: '\n\n', delay: 400, typeSpeed: 0 },
  // Done
  { text: '✓ fix applied', className: 'c-ok', delay: 0, typeSpeed: 25 },
  { text: ' — 3 pods restarting, ETA 12s\n', className: 'c-mut', delay: 0, typeSpeed: 16 },
  { text: '  incident #4821 resolved. MTTR: 34s', className: 'c-ok', delay: 400, typeSpeed: 22 },
  { text: '\n', delay: 0, typeSpeed: 0 },
];

export default function InteractiveTerminal() {
  const [animatedSegments, setAnimatedSegments] = useState<{ text: string; className?: string }[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const preRef = useRef<HTMLPreElement>(null);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function addChar(char: string, className?: string) {
    setAnimatedSegments(prev => {
      const last = prev[prev.length - 1];
      if (last && last.className === className) {
        return [...prev.slice(0, -1), { text: last.text + char, className }];
      }
      return [...prev, { text: char, className }];
    });
  }

  function runAnimation() {
    setAnimatedSegments([]);
    let totalDelay = 0;

    ANIMATED_FRAMES.forEach(frame => {
      totalDelay += frame.delay || 0;
      const speed = frame.typeSpeed || 0;

      if (speed === 0) {
        const d = totalDelay;
        timers.current.push(setTimeout(() => {
          setAnimatedSegments(prev => {
            const last = prev[prev.length - 1];
            if (last && last.className === frame.className) {
              return [...prev.slice(0, -1), { text: last.text + frame.text, className: frame.className }];
            }
            return [...prev, { text: frame.text, className: frame.className }];
          });
        }, d));
      } else {
        for (let i = 0; i < frame.text.length; i++) {
          const d = totalDelay + i * speed;
          const char = frame.text[i];
          const cn = frame.className;
          timers.current.push(setTimeout(() => addChar(char, cn), d));
        }
        totalDelay += frame.text.length * speed;
      }
    });

    // Loop: hold finished state, then restart
    totalDelay += 3500;
    timers.current.push(setTimeout(() => runAnimation(), totalDelay));
  }

  useEffect(() => {
    runAnimation();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when new content appears
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [animatedSegments]);

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="tdot r"></span>
        <span className="tdot y"></span>
        <span className="tdot g"></span>
        <span className="tname">kubric • incident #4821 • prod-us-east</span>
      </div>
      <pre ref={preRef} className="terminal-body">
        {/* Static part — always visible */}
        <span className="c-mut">$</span>{' '}
        <span className="c-cmd">kubric diagnose</span>{' --ns payments --since 5m\n'}
        <span className="c-mut">{'→ scanning 312 pods · 4 nodes · 17 services …'}</span>
        {'\n\n'}
        <span className="c-ok">{'✓ root cause identified'}</span>{' '}
        <span className="c-mut">{'(confidence 0.94)'}</span>
        {'\n'}
        <span className="c-key">{'pod'}</span>{'      checkout-api-7df9c-xk2lq\n'}
        <span className="c-key">{'status'}</span>{'   CrashLoopBackOff × 23\n'}
        <span className="c-key">{'cause'}</span>{'    OOMKilled — memory limit 512Mi exceeded\n'}
        {'            after deploy '}
        <span className="c-warn">{'v1.42.0'}</span>{' (+38% heap usage)\n\n'}
        <span className="c-key">{'fix'}</span>{'      bump resources.limits.memory → 768Mi\n'}
        {'         and revert PR #2814 (leak in JsonCodec.flush)\n\n'}
        <span className="c-mut">{'apply now?'}</span>{' '}
        <span className="c-cmd">{'[y/N]'}</span>{' '}
        {/* Animated part — types "y" then shows apply flow */}
        {animatedSegments.map((seg, i) => (
          seg.className
            ? <span key={i} className={seg.className}>{seg.text}</span>
            : <span key={i}>{seg.text}</span>
        ))}
        <span className="cursor">▍</span>
      </pre>
    </div>
  );
}
