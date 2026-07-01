'use client';

import { useEffect, useRef, useState } from 'react';

interface ChatMsg {
  role: 'user' | 'kubric';
  text: string;
}

const SUGGESTIONS = [
  'Why is my cluster unhealthy?',
  'Is the cluster ready for peak traffic?',
  'What changed in the last hour?',
  'Summarize recent warning events',
];

export default function AskKubricScreen({ selectedCluster, initials }: { selectedCluster: string; initials: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, cluster_context: selectedCluster || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'kubric', text: data.reply || 'No response.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'kubric', text: 'The backend returned an error. Is it running?' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'kubric', text: 'Could not reach the backend at localhost:8000.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="kb-ask-screen">
      <div className="kb-ask-chat" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="kb-ask-empty">
            <p className="kb-ask-empty-title">Ask anything about your cluster</p>
            <div className="kb-ask-chips">
              {SUGGESTIONS.map(s => (
                <button key={s} className="kb-ask-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`kb-chat-row ${m.role}`}>
              <div className={`kb-chat-avatar ${m.role}`}>{m.role === 'user' ? initials : 'K'}</div>
              <div className={`kb-chat-bubble ${m.role}`}>
                {m.role === 'kubric' && <span className="kb-chat-tag">kubric · {selectedCluster || 'no cluster'}</span>}
                {m.text}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="kb-chat-row kubric">
            <div className="kb-chat-avatar kubric">K</div>
            <div className="kb-chat-bubble kubric">
              <span className="kb-chat-tag">kubric · {selectedCluster || 'no cluster'}</span>
              <span className="kb-typing"><span /><span /><span /></span>
            </div>
          </div>
        )}
      </div>

      <div className="kb-ask-input-wrap">
        <div className="kb-ask-input-inner">
          <textarea
            className="kb-ask-textarea"
            placeholder="Ask anything about your cluster — or say 'why is payment-svc down'"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="kb-btn primary" onClick={() => send(input)} disabled={sending || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}
