'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface ChatMsg {
  role: 'user' | 'kubric';
  text: string;
  image?: string; // data URL
}

const SUGGESTIONS = [
  { icon: '△', text: 'Why is my cluster unhealthy?' },
  { icon: '◎', text: 'Is the cluster ready for peak traffic?' },
  { icon: '⟲', text: 'What changed in the last hour?' },
  { icon: '⚠', text: 'Summarize recent warning events' },
];

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB guard

// Strip stray markdown markers so replies render as clean plain text.
function cleanReply(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')   // heading markers at line start
    .replace(/#{2,}\s*/g, '')              // inline ### that slipped in mid-line
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold**
    .replace(/(^|\s)[*_](\S.*?\S)[*_](\s|$)/g, '$1$2$3') // *italic*/_italic_
    .replace(/^\s*[-*]\s+/gm, '• ')        // bullet markers -> bullet dot
    .trim();
}

export default function AskKubricScreen({ selectedCluster, initials }: { selectedCluster: string; initials: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Clear any pending stream timer on unmount.
  useEffect(() => () => { if (streamTimer.current) clearTimeout(streamTimer.current); }, []);

  // Reveal a reply progressively (Claude-style stream) into a new kubric bubble.
  const streamInReply = (full: string) => {
    setMessages(prev => [...prev, { role: 'kubric', text: '' }]);
    setStreaming(true);
    let i = 0;
    const tick = () => {
      // Reveal a small batch of characters, snapping to the next space for smoothness.
      let next = Math.min(full.length, i + 3);
      const nextSpace = full.indexOf(' ', next);
      if (nextSpace !== -1 && nextSpace - next < 4) next = nextSpace + 1;
      i = next;
      const shown = full.slice(0, i);
      setMessages(prev => {
        const copy = [...prev];
        const last = copy.length - 1;
        if (last >= 0 && copy[last].role === 'kubric') {
          copy[last] = { ...copy[last], text: shown };
        }
        return copy;
      });
      if (i < full.length) {
        // Pause a touch longer after line breaks so it reads line-by-line.
        const delay = full[i - 1] === '\n' ? 90 : 14;
        streamTimer.current = setTimeout(tick, delay);
      } else {
        streamTimer.current = null;
        setStreaming(false);
      }
    };
    tick();
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImageFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image is too large (max 4MB).');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
    } catch {
      /* ignore */
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        addImageFile(item.getAsFile());
        break;
      }
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    const img = image;
    if ((!trimmed && !img) || sending || streaming) return;
    setMessages(prev => [...prev, { role: 'user', text: trimmed, image: img || undefined }]);
    setInput('');
    setImage(null);
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed || 'Analyze this image and suggest a fix.',
          cluster_context: selectedCluster || null,
          image: img || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSending(false);
        streamInReply(cleanReply(data.reply || 'No response.'));
      } else {
        setSending(false);
        streamInReply('The backend returned an error. Is it running?');
      }
    } catch {
      setSending(false);
      streamInReply('Could not reach the Kubric backend. Is it running?');
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
            <div className="kb-ask-hero">
              <img src="/kubric-logo.png" alt="Kubric" className="kb-ask-logo" />
              <div className="kb-ask-hero-glow" />
            </div>
            <p className="kb-ask-empty-title">Ask Kubric anything about your cluster</p>
            <p className="kb-ask-empty-sub">Grounded in your live cluster state — pods, events, nodes, and metrics. Attach a screenshot and Kubric will read it.</p>
            <div className="kb-ask-chips">
              {SUGGESTIONS.map(s => (
                <button key={s.text} className="kb-ask-chip" onClick={() => send(s.text)}>
                  <span className="kb-ask-chip-icon">{s.icon}</span>
                  <span>{s.text}</span>
                  <span className="kb-ask-chip-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`kb-chat-row ${m.role}`}>
              <div className={`kb-chat-avatar ${m.role}`}>
                {m.role === 'user' ? initials : <img src="/kubric-logo.png" alt="K" className="kb-chat-avatar-img" />}
              </div>
              <div className={`kb-chat-bubble ${m.role}`}>
                {m.role === 'kubric' && <span className="kb-chat-tag">kubric · {selectedCluster || 'no cluster'}</span>}
                {m.image && <img src={m.image} alt="attachment" className="kb-chat-image" />}
                {m.text}
                {streaming && m.role === 'kubric' && i === messages.length - 1 && <span className="kb-stream-cursor" />}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="kb-chat-row kubric">
            <div className="kb-chat-avatar kubric"><img src="/kubric-logo.png" alt="K" className="kb-chat-avatar-img" /></div>
            <div className="kb-chat-bubble kubric">
              <span className="kb-chat-tag">kubric · {selectedCluster || 'no cluster'}</span>
              <span className="kb-typing"><span /><span /><span /></span>
            </div>
          </div>
        )}
      </div>

      <div className="kb-ask-input-wrap">
        {image && (
          <div className="kb-ask-preview">
            <span className="kb-ask-preview-box">
              <img src={image} alt="preview" className="kb-ask-preview-img" />
              <button className="kb-ask-preview-remove" onClick={() => setImage(null)} aria-label="Remove image">✕</button>
            </span>
          </div>
        )}
        <div className="kb-ask-input-inner">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { addImageFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button
            className="kb-ask-attach"
            onClick={() => fileRef.current?.click()}
            disabled={sending || streaming}
            title="Attach image"
            aria-label="Attach image"
          >
            ＋
          </button>
          <textarea
            className="kb-ask-textarea"
            placeholder="Ask anything — or attach/paste a screenshot for Kubric to analyze"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
          />
          <span className="kb-ask-hint">↵ send</span>
          <button className="kb-ask-send" onClick={() => send(input)} disabled={sending || streaming || (!input.trim() && !image)}>
            <span>Send</span>
            <span className="kb-ask-send-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
