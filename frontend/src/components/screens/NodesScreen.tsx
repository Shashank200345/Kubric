'use client';

import { useEffect, useState } from 'react';

interface Node {
  name: string;
  roles: string[];
  status: string;
  cpu_pct: number;
  mem_pct: number;
  cpu_capacity: string;
  mem_capacity: string;
  created_at: string | null;
}

export default function NodesScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/nodes');
        if (res.ok && active) {
          const data = await res.json();
          setNodes(data.nodes || []);
        }
      } catch { /* backend not ready */ } finally {
        if (active) setLoading(false);
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const readyCount = nodes.filter(n => n.status === 'Ready').length;

  return (
    <div className="kb-screen">
      <div className="kb-welcome">
        <div>
          <h1 className="kb-welcome-title">Nodes</h1>
          <p className="kb-welcome-sub">{readyCount}/{nodes.length} nodes ready</p>
        </div>
      </div>

      {loading ? (
        <div className="kb-card"><div className="kb-empty tall">Loading nodes…</div></div>
      ) : nodes.length === 0 ? (
        <div className="kb-card"><div className="kb-empty tall">No nodes found. Is the backend connected to a cluster?</div></div>
      ) : (
        <div className="kb-node-grid">
          {nodes.map(n => (
            <div key={n.name} className="kb-card kb-node-card">
              <div className="kb-node-head">
                <span className={`kb-dot-sm ${n.status === 'Ready' ? 'ok' : 'crit'}`} />
                <span className="kb-node-name">{n.name}</span>
                <span className={`kb-tag ${n.status === 'Ready' ? 'teal' : 'red'}`}>{n.status}</span>
              </div>
              <div className="kb-node-roles">{n.roles.join(', ')}</div>

              <div className="kb-meter">
                <div className="kb-meter-head"><span>CPU</span><span className="kb-meter-pct">{n.cpu_pct}%</span></div>
                <NodeSegBar pct={n.cpu_pct} />
              </div>
              <div className="kb-meter">
                <div className="kb-meter-head"><span>Memory</span><span className="kb-meter-pct">{n.mem_pct}%</span></div>
                <NodeSegBar pct={n.mem_pct} />
              </div>

              <div className="kb-node-caps">
                <span>{n.cpu_capacity} vCPU</span>
                <span>{n.mem_capacity} mem</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeSegBar({ pct }: { pct: number }) {
  const segs = 20;
  const filled = Math.round((Math.min(pct, 100) / 100) * segs);
  return (
    <div className="kb-segbar">
      {Array.from({ length: segs }).map((_, i) => (
        <span key={i} className={`kb-seg ${i < filled ? 'on' : ''}`} />
      ))}
    </div>
  );
}
