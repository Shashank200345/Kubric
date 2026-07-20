'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface ChatMsg {
  role: 'user' | 'kubric';
  text: string;
}

interface DeepDiveProps {
  incidentContext: string;      // serialized diagnosis for grounding
  selectedCluster: string;
  incidentKey: string;          // resets the conversation when the incident changes
}

const QUICK_QUESTIONS = [
  'Why did this happen?',
  'What is the impact if I ignore it?',
  'Is it safe to apply the suggested fix?',
  'How do I verify the fix worked?',
  'How do I prevent this in the future?',
];

// Strip stray markdown so replies render as clean plain text.
function cleanReply(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/#{2,}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}

export default function IncidentDeepDive({ incidentContext, selectedCluster, incidentKey }: DeepDiveProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the conversation whenever the incident changes.
  useEffect(() => {
    setMessages([]);
    setInput('');
    setBusy(false);
  }, [incidentKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => () => { if (streamTimer.current) clearTimeout(streamTimer.current); }, []);

  const streamInReply = (full: string) => {
    setMessages(prev => [...prev, { role: 'kubric', text: '' }]);
    let i = 0;
    const tick = () => {
      let next = Math.min(full.length, i + 3);
      const nextSpace = full.indexOf(' ', next);
      if (nextSpace !== -1 && nextSpace - next < 4) next = nextSpace + 1;
      i = next;
      const shown = full.slice(0, i);
      setMessages(prev => {
        const copy = [...prev];
        const last = copy.length - 1;
        if (last >= 0 && copy[last].role === 'kubric') copy[last] = { role: 'kubric', text: shown };
        return copy;
      });
      if (i < full.length) {
        streamTimer.current = setTimeout(tick, full[i - 1] === '\n' ? 80 : 12);
      }
    };
    tick();
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          cluster_context: selectedCluster || null,
          incident_context: incidentContext,
        }),
      });
      setBusy(false);
      if (res.ok) {
        const data = await res.json();
        streamInReply(cleanReply(data.reply || 'No response.'));
      } else {
        streamInReply('The backend returned an error while analyzing this incident.');
      }
    } catch {
      setBusy(false);
      streamInReply('Could not reach the Kubric backend.');
    }
  };

  return (
    <div className={`kb-dd ${open ? 'open' : ''}`}>
      <button className="kb-dd-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="kb-dd-toggle-icon">✦</span>
        <span className="kb-dd-toggle-text">
          <span className="kb-dd-toggle-title">Dig deeper into this incident</span>
          <span className="kb-dd-toggle-sub">Ask Kubric follow-up questions grounded in this diagnosis</span>
        </span>
        <span className="kb-dd-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="kb-dd-body">
          {messages.length > 0 && (
            <div className="kb-dd-chat" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`kb-dd-row ${m.role}`}>
                  <div className={`kb-dd-avatar ${m.role}`}>
                    {m.role === 'user' ? 'you' : <img src="/kubric-logo.png" alt="K" className="kb-dd-avatar-img" />}
                  </div>
                  <div className={`kb-dd-bubble ${m.role}`}>{m.text || '…'}</div>
                </div>
              ))}
              {busy && (
                <div className="kb-dd-row kubric">
                  <div className="kb-dd-avatar kubric"><img src="/kubric-logo.png" alt="K" className="kb-dd-avatar-img" /></div>
                  <div className="kb-dd-bubble kubric"><span className="kb-dd-typing"><span /><span /><span /></span></div>
                </div>
              )}
            </div>
          )}

          <div className="kb-dd-chips">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} className="kb-dd-chip" onClick={() => ask(q)} disabled={busy}>{q}</button>
            ))}
          </div>

          <div className="kb-dd-input">
            <input
              className="kb-dd-field"
              placeholder="Ask anything about this incident…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
              disabled={busy}
            />
            <button className="kb-dd-send" onClick={() => ask(input)} disabled={busy || !input.trim()}>Ask →</button>
          </div>
        </div>
      )}
    </div>
  );
}
