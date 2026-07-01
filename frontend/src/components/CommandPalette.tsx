'use client';

import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  clusters: string[];
}

const COMMANDS = [
  { id: 'overview', label: 'Go to Overview', icon: '▦' },
  { id: 'troubleshoot', label: 'Go to Troubleshoot', icon: '◎' },
  { id: 'incidents', label: 'Go to Incidents', icon: '△' },
  { id: 'prrisk', label: 'Go to PR Risk', icon: '⑂' },
  { id: 'workloads', label: 'Go to Workloads', icon: '▤' },
  { id: 'nodes', label: 'Go to Nodes', icon: '✦' },
  { id: 'ask', label: 'Ask Kubric', icon: '✺' },
  { id: 'playbooks', label: 'Go to Playbooks', icon: '▥' },
  { id: 'settings', label: 'Go to Settings', icon: '⚙' },
];

export default function CommandPalette({ open, onClose, onNavigate, clusters }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIdx(0); }
  }, [open]);

  const results = [
    ...COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase())),
    ...clusters.filter(c => c.toLowerCase().includes(query.toLowerCase())).map(c => ({ id: `cluster:${c}`, label: c, icon: '⬡' })),
  ];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[selectedIdx];
        if (r && !r.id.startsWith('cluster:')) onNavigate(r.id);
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selectedIdx, onNavigate, onClose]);

  if (!open) return null;

  return (
    <div className="kb-cmdk-overlay" onClick={onClose}>
      <div className="kb-cmdk" onClick={e => e.stopPropagation()}>
        <input
          className="kb-cmdk-input"
          autoFocus
          placeholder="Search services, ask Kubric, run a command…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
        />
        <div className="kb-cmdk-results">
          {results.length === 0 ? (
            <div className="kb-cmdk-empty">No results</div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.id}
                className={`kb-cmdk-item ${i === selectedIdx ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => { if (!r.id.startsWith('cluster:')) onNavigate(r.id); onClose(); }}
              >
                <span className="kb-cmdk-icon">{r.icon}</span>
                <span>{r.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
