'use client';

// Shared dashboard styles � used by the live dashboard and the hero showcase.

export default function KubricStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .kb {
        --bg:#060B08; --s1:#0B130D; --s2:#0F1A12; --s3:#16241A;
        --bd:rgba(255,255,255,0.07); --bd2:rgba(255,255,255,0.12);
        --green:#7cffb2; --green-dim:rgba(124,255,178,0.10); --green-bd:rgba(124,255,178,0.28);
        --crit:#ff6b6b; --crit-dim:rgba(255,107,107,0.10); --crit-bd:rgba(255,107,107,0.28);
        --t1:rgba(255,255,255,0.92); --t2:rgba(255,255,255,0.50); --t3:rgba(255,255,255,0.30);
        background:var(--bg); color:var(--t1);
        font-family:var(--font-inter), system-ui, -apple-system, sans-serif;
      }
      /* Lexend for all headings inside the dashboard */
      .kb h1, .kb h2, .kb h3, .kb h4, .kb h5, .kb h6,
      .kb [class*="-title"], .kb [class*="-heading"] {
        font-family: var(--font-lexend), system-ui, -apple-system, sans-serif;
        font-weight: 400;
      }
      .kb .custom-scrollbar, .kb-scroll { scrollbar-width:thin; scrollbar-color:#2f9e62 var(--s1); }
      .kb .custom-scrollbar::-webkit-scrollbar, .kb-scroll::-webkit-scrollbar { width:7px; height:7px; background:var(--s1); }
      .kb .custom-scrollbar::-webkit-scrollbar-track, .kb-scroll::-webkit-scrollbar-track { background:var(--s1); border-left:1px solid var(--green-dim); }
      .kb .custom-scrollbar::-webkit-scrollbar-thumb, .kb-scroll::-webkit-scrollbar-thumb { background:#2f9e62; border:1px solid var(--s1); background-clip:padding-box; }
      .kb .custom-scrollbar::-webkit-scrollbar-thumb:hover, .kb-scroll::-webkit-scrollbar-thumb:hover { background:var(--green); }
      .kb .custom-scrollbar::-webkit-scrollbar-button, .kb-scroll::-webkit-scrollbar-button { display:none; width:0; height:0; }

      .kb-spinner { width:22px; height:22px; border:2px solid var(--green-bd); border-top-color:var(--green); border-radius:50% !important; animation:kb-spin .8s linear infinite; }
      .kb-spinner.sm { width:13px; height:13px; } .kb-spinner.xs { width:12px; height:12px; display:inline-block; }
      @keyframes kb-spin { to { transform:rotate(360deg); } }
      @keyframes kb-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
      .kb .pulse { animation:kb-pulse 2s ease-in-out infinite; }

      /* ── section transition ───────────────────────────────────────── */
      @keyframes kb-screen-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      .kb-screen-anim {
        animation: kb-screen-in 0.20s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      /* shell */
      .kb-shell { display:grid; grid-template-columns:236px 1fr; height:100vh; overflow:hidden; }

      /* sidebar */
      .kb-side { display:flex; flex-direction:column; background:var(--s1); border-right:0.5px solid var(--bd); overflow:hidden; }
      .kb-side-logo { display:flex; align-items:center; gap:4px; padding:18px 18px 14px; }
      .kb-side-logo-img { height:36px; width:auto; }
      .kb-side-logo-name { font-family:"Fredoka", system-ui, sans-serif; font-size:18px; font-weight:600; letter-spacing:0.08em; color:#f4f7f9; }
      .kb-nav { flex:1; overflow-y:auto; padding:6px 0; display:flex; flex-direction:column; }
      .kb-nav-section { padding:0 10px; margin-bottom:10px; }
      .kb-nav-label { font-size:9px; text-transform:uppercase; letter-spacing:0.12em; color:var(--t3); padding:10px 8px 6px; }
      .kb-nav-item { width:100%; display:flex; align-items:center; gap:10px; padding:8px 10px; font-size:13px; color:var(--t2); background:transparent; border:none; cursor:pointer; text-align:left; transition:all .12s ease; }
      .kb-nav-item:hover { background:rgba(255,255,255,0.05); color:var(--t1); }
      .kb-nav-item.active { background:var(--green-dim); color:var(--green); }
      .kb-nav-icon { width:18px; text-align:center; font-size:13px; opacity:0.9; }
      .kb-nav-badge { margin-left:auto; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; color:var(--green); background:var(--green-dim); padding:1px 6px; }
      .kb-nav-badge.crit { color:var(--crit); background:var(--crit-dim); }
      .kb-nav-support { margin-top:auto; }
      .kb-profile { display:flex; align-items:center; gap:10px; padding:12px 14px; border-top:0.5px solid var(--bd); }
      .kb-avatar { width:30px; height:30px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--green); background:var(--green-dim); border:0.5px solid var(--green-bd); }
      .kb-profile-info { flex:1; min-width:0; }
      .kb-profile-name { font-size:12px; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .kb-profile-mail { font-size:10px; color:var(--t3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .kb-profile-out { background:none; border:none; color:var(--t3); cursor:pointer; font-size:16px; padding:4px; }
      .kb-profile-out:hover { color:var(--crit); }

      /* main column */
      .kb-maincol { display:flex; flex-direction:column; overflow:hidden; }
      .kb-topbar { height:54px; flex-shrink:0; display:flex; align-items:center; gap:16px; padding:0 22px; border-bottom:0.5px solid var(--bd); background:var(--s1); }
      .kb-search { flex:1; max-width:440px; display:flex; align-items:center; gap:8px; background:var(--s2); border:0.5px solid var(--bd); padding:7px 12px; }
      .kb-search-icon { color:var(--t3); font-size:14px; }
      .kb-search-input { flex:1; background:transparent; border:none; outline:none; color:var(--t1); font-family:var(--font-jetbrains-mono), monospace; font-size:12px; }
      .kb-search-input::placeholder { color:var(--t3); }
      .kb-kbd { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); background:var(--s3); padding:2px 6px; }
      .kb-topbar-right { margin-left:auto; display:flex; align-items:center; gap:12px; }
      .kb-icon-btn { background:transparent; border:0.5px solid var(--bd2); color:var(--t2); width:30px; height:30px; cursor:pointer; }
      .kb-icon-btn:hover { background:var(--s3); color:var(--t1); }
      .kb-cluster-pill { display:inline-flex; align-items:center; gap:7px; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); background:var(--s2); border:0.5px solid var(--bd); padding:5px 11px; }
      .kb-dot { width:6px; height:6px; background:var(--green); box-shadow:0 0 6px var(--green); }

      /* scroll + screens */
      .kb-scroll { flex:1; overflow-y:auto; }
      .kb-screen { padding:24px 28px 60px; display:flex; flex-direction:column; gap:18px; max-width:1320px; }

      /* welcome header */
      .kb-welcome { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
      .kb-welcome-title { font-family:var(--font-lexend), system-ui, sans-serif; font-size:26px; font-weight:400; color:var(--t1); margin:0; letter-spacing:-0.01em; }
      .kb-welcome-title .accent { color:var(--green); }
      .kb-welcome-sub { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t3); margin-top:5px; }
      .kb-welcome-actions { display:flex; gap:10px; }

      /* buttons */
      .kb-btn { font-family:inherit; font-size:12px; color:var(--t2); background:var(--s2); border:0.5px solid var(--bd2); padding:8px 16px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:all .2s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 6px; }
      .kb-btn:hover { background:var(--s3); color:var(--t1); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .kb-btn:active { transform: scale(0.97); }
      .kb-btn.primary { background:var(--green-dim); border-color:var(--green-bd); color:var(--green); box-shadow: 0 0 10px rgba(124, 255, 178, 0.1); }
      .kb-btn.primary:hover { background:rgba(124,255,178,0.18); box-shadow: 0 0 15px rgba(124, 255, 178, 0.2); }
      .kb-btn:disabled { opacity:0.45; cursor:not-allowed; transform: none; box-shadow: none; }

      /* stat cards */
      .kb-stat-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
      .kb-statcard { background:var(--s1); border:0.5px solid var(--bd); padding:16px; }
      .kb-statcard-top { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
      .kb-statcard-icon { color:var(--green); font-size:13px; }
      .kb-statcard-label { font-size:11px; color:var(--t2); }
      .kb-statcard-dots { margin-left:auto; color:var(--t3); }
      .kb-statcard-val { font-family:var(--font-jetbrains-mono), monospace; font-size:30px; line-height:1; color:var(--t1); }
      .kb-statcard-val.ok { color:var(--green); } .kb-statcard-val.crit { color:var(--crit); }
      .kb-statcard-foot { margin-top:12px; padding-top:10px; border-top:0.5px solid var(--bd); }
      .kb-statcard-meta { font-size:10px; color:var(--t3); }
      .kb-statcard-clickable { cursor: pointer; transition: all 0.2s ease; }
      .kb-statcard-clickable:hover { border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.02); box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }

      /* grid 2 (chart + resource) */
      .kb-grid-2 { display:grid; grid-template-columns:1.7fr 1fr; gap:14px; }
      .kb-card { background:var(--s1); border:0.5px solid var(--bd); }
      .kb-col-header { display:flex; align-items:center; gap:10px; padding:13px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-col-title { font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:0.07em; color:var(--t2); }
      .kb-col-title.crit { color:var(--crit); }
      .kb-count { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); background:var(--s3); padding:1px 7px; }
      .kb-config { margin-left:auto; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-pill-mini { margin-left:auto; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; color:var(--t3); border:0.5px solid var(--bd); padding:2px 7px; text-transform:uppercase; }

      .kb-chart-wrap { padding:16px; }
      .kb-chart { width:100%; height:220px; display:block; }
      .kb-chart-axis { display:flex; justify-content:space-between; margin-top:8px; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-legend { display:flex; gap:16px; padding:0 0 10px; flex-wrap:wrap; }
      .kb-legend-item { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t2); }
      .kb-legend-dot { width:8px; height:3px; }

      /* meters */
      .kb-meters { padding:16px; display:flex; flex-direction:column; gap:16px; }
      .kb-meter-head { display:flex; justify-content:space-between; font-size:11px; color:var(--t2); margin-bottom:7px; }
      .kb-meter-pct { font-family:var(--font-jetbrains-mono), monospace; color:var(--green); }
      .kb-segbar { display:flex; gap:2px; }
      .kb-seg { flex:1; height:9px; background:var(--s3); }
      .kb-seg.on { background:var(--green); box-shadow:0 0 4px rgba(124,255,178,0.4); }
      .kb-anomaly { margin:0 16px 16px; padding:12px; background:var(--s2); border:0.5px solid var(--bd); }
      .kb-anomaly-head { font-size:11px; color:var(--t2); margin-bottom:8px; }
      .kb-anomaly-row { font-size:11px; color:var(--t3); line-height:1.6; }
      .kb-anomaly-row.ok { color:var(--green); }

      /* error */
      .kb-error { display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--crit-dim); border:0.5px solid var(--crit-bd); color:var(--crit); font-size:13px; padding:12px 16px; }
      .kb-error button { background:none; border:none; color:var(--crit); font-size:18px; cursor:pointer; }

      /* cluster grid */
      .kb-cluster-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; padding:16px; max-height:360px; overflow-y:auto; }
      .kb-cluster-card { background:var(--s2); border:0.5px solid var(--bd); padding:14px; cursor:pointer; transition:all .15s ease; }
      .kb-cluster-card:hover { border-color:var(--bd2); background:var(--s3); }
      .kb-cluster-card.selected { background:var(--green-dim); border-color:var(--green-bd); }
      .kb-cluster-card.disabled { opacity:0.45; cursor:not-allowed; }
      .kb-cluster-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
      .kb-cluster-icon { font-size:18px; color:var(--t3); }
      .kb-cluster-card.selected .kb-cluster-icon { color:var(--green); }
      .kb-cluster-name { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .kb-cluster-ns { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); margin:5px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .kb-tag { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; padding:2px 7px; text-transform:uppercase; }
      .kb-tag.teal { background:var(--green-dim); color:var(--green); border:0.5px solid var(--green-bd); }
      .kb-empty { grid-column:1/-1; text-align:center; color:var(--t3); font-size:13px; padding:24px; }
      .kb-empty.tall { padding:48px 24px; }

      /* two-col + progress + diagnosis */
      .kb-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:stretch; }
      .kb-card-wrap { display:flex; } .kb-card-wrap > .kb-card { flex:1; }
      .kb-progress { list-style:none; margin:0; padding:18px 16px; display:flex; flex-direction:column; gap:14px; }
      .kb-step { display:flex; align-items:center; gap:12px; font-size:13px; color:var(--t3); }
      .kb-step.completed { color:var(--t1); } .kb-step.running { color:var(--green); }
      .kb-step-icon { width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; border:0.5px solid var(--bd); flex-shrink:0; }
      .kb-step.completed .kb-step-icon { color:var(--green); border-color:var(--green-bd); background:var(--green-dim); }
      .kb-step.running .kb-step-icon { border-color:var(--green-bd); }
      .kb-step-name.strong { font-weight:500; }
      .kb-step.running .kb-step-name { animation:kb-pulse 1.5s ease-in-out infinite; }
      .kb-diagnosis.crit { border-color:var(--crit-bd); }
      .kb-diag-body { padding:18px 16px; display:flex; flex-direction:column; gap:18px; font-size:13px; }
      .kb-field-label { display:block; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:var(--t3); margin-bottom:6px; }
      .kb-field-label.accent { color:var(--green); }
      .kb-root-cause { color:var(--t1); font-size:15px; font-weight:500; line-height:1.4; margin:0; }
      .kb-nested { background:var(--bg); border:0.5px solid var(--bd); padding:12px; }
      .kb-explanation { color:var(--t2); line-height:1.6; margin:0; }
      .kb-fix { color:var(--t1); line-height:1.6; margin:0; }
      .kb-code { display:block; background:var(--bg); border:0.5px solid var(--bd); color:var(--green); font-family:var(--font-jetbrains-mono), monospace; font-size:11px; padding:12px; line-height:1.7; word-break:break-all; }
      .kb-confidence-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
      .kb-confidence-val { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--green); }
      .kb-bar { height:3px; background:var(--s3); overflow:hidden; } .kb-bar.sm { width:48px; }
      .kb-bar-fill { height:100%; background:var(--green); transition:width 1s ease-out; }
      .kb-healthy { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 24px; border-color:var(--green-bd); }
      .kb-healthy-icon { width:48px; height:48px; display:flex; align-items:center; justify-content:center; font-size:22px; color:var(--green); border:0.5px solid var(--green-bd); background:var(--green-dim); margin-bottom:18px; }
      .kb-healthy-title { color:var(--green); font-size:18px; font-weight:500; margin:0 0 8px; }
      .kb-healthy-sub { color:var(--t2); font-size:13px; max-width:320px; line-height:1.55; margin:0; }

      /* table */
      .kb-table-wrap { overflow-x:auto; }
      .kb-table { width:100%; border-collapse:collapse; font-size:13px; }
      .kb-table th { text-align:left; font-weight:500; color:var(--t3); padding:10px 16px; border-bottom:1px solid var(--bd); }
      .kb-table td { padding:12px 16px; border-bottom:0.5px solid var(--bd2); color:var(--t2); }
      .kb-table tbody tr { transition: all 0.2s ease; cursor: pointer; }
      .kb-table tbody tr:hover { background: rgba(255, 255, 255, 0.03); transform: scale(1.002); }
      .kb-table tbody tr:last-child td { border-bottom:none; }
      .kb-td-date { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t3); white-space:nowrap; }
      .kb-td-cause { color:var(--t2); } .kb-table tbody tr:hover .kb-td-cause { color:var(--t1); }
      .kb-td-healthy { color:var(--green); }
      .kb-td-conf { color:var(--t3); font-family:var(--font-jetbrains-mono), monospace; font-size:11px; }
      .kb-td-conf-inner { display:flex; align-items:center; gap:8px; }
      .kb-status { display:inline-block; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; padding:3px 8px; border:0.5px solid; }
      .kb-status.crit { background:var(--crit-dim); color:var(--crit); border-color:var(--crit-bd); }
      .kb-status.ok { background:var(--green-dim); color:var(--green); border-color:var(--green-bd); }
      .kb-status.run { background:var(--green-dim); color:var(--green); border-color:var(--green-bd); animation:kb-pulse 1.5s ease-in-out infinite; }
      .kb-status.idle { background:var(--s3); color:var(--t3); border-color:var(--bd); }

      /* tooltip */
      .kb-tooltip {
        position:absolute; top:-4px; transform:translateX(-50%) translateY(-100%);
        background:var(--s1); border:0.5px solid var(--green-bd); padding:9px 12px; z-index:10;
        pointer-events:none; white-space:nowrap; min-width:140px;
        box-shadow:0 8px 24px rgba(0,0,0,0.6);
        transition: left 0.15s ease;
      }
      .kb-tooltip-day { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--green); margin-bottom:7px; text-transform:uppercase; letter-spacing:0.08em; }
      .kb-tooltip-row { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--t2); line-height:1.8; }
      .kb-tooltip-dot { width:6px; height:6px; flex-shrink:0; }
      .kb-tooltip-label { flex:1; }
      .kb-tooltip-val { font-family:var(--font-jetbrains-mono), monospace; color:var(--t1); }

      /* coming soon */
      .kb-soon { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:64px 24px; gap:14px; }
      .kb-soon-icon { font-size:32px; color:var(--green); }
      .kb-soon-title { font-size:18px; font-weight:500; color:var(--t1); margin:0; }
      .kb-soon-sub { font-size:13px; color:var(--t2); max-width:380px; line-height:1.6; margin:0 0 6px; }

      /* modals */
      @keyframes kb-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kb-modal-slide-up { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      
      .kb-modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: kb-modal-fade-in 0.2s ease-out forwards; }
      .kb-modal { background: var(--bg); border: 0.5px solid var(--bd); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6); overflow: hidden; display: flex; flex-direction: column; width: 850px; max-width: 90vw; max-height: 85vh; border-radius: 8px; animation: kb-modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .kb-modal-header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 0.5px solid var(--bd); background: var(--s1); gap: 16px; }
      .kb-modal-title { font-size: 15px; font-weight: 500; color: var(--t1); margin: 0; white-space: nowrap; }
      .kb-modal-close { background: transparent; border: none; color: var(--t3); font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; line-height: 1; transition: color 0.15s ease; padding: 0; margin-right: -8px; }
      .kb-modal-close:hover { color: var(--t1); }
      .kb-modal-body { flex: 1 1 auto; padding: 20px; overflow-y: auto; position: relative; }
      .kb-modal-footer { flex: 0 0 auto; display: flex; align-items: center; justify-content: flex-end; padding: 16px 20px; border-top: 0.5px solid var(--bd); background: var(--s1); gap: 12px; }

      @media (max-width: 1024px) {
        .kb-shell { grid-template-columns:64px 1fr; }
        .kb-side-logo-name, .kb-nav-label, .kb-nav-item span:not(.kb-nav-icon):not(.kb-nav-badge), .kb-profile-info { display:none; }
        .kb-nav-item { justify-content:center; }
        .kb-grid-2 { grid-template-columns:1fr; }
        .kb-stat-row { grid-template-columns:1fr 1fr; }
        .kb-two-col { grid-template-columns:1fr; }
      }
      @media (max-width: 600px) {
        .kb-stat-row { grid-template-columns:1fr 1fr; }
        .kb-welcome { flex-direction:column; align-items:flex-start; }
      }

      /* ---------- filter bar (Incidents) ---------- */
      .kb-filterbar { margin-left:auto; display:flex; gap:6px; }
      .kb-filter-pill { padding:3px 10px; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; border:0.5px solid var(--bd); background:transparent; color:var(--t3); cursor:pointer; font-family:var(--font-jetbrains-mono), monospace; }
      .kb-filter-pill.active { background:var(--green-dim); border-color:var(--green-bd); color:var(--green); }

      /* ---------- incident rows / accordion ---------- */
      .kb-inc-row-wrap { border-bottom:0.5px solid var(--bd); }
      .kb-inc-row { display:grid; grid-template-columns:10px 1fr auto auto; gap:12px; align-items:flex-start; padding:14px 16px; cursor:pointer; transition:background .12s ease; }
      .kb-inc-row:hover { background:var(--s2); }
      .kb-inc-dot { width:7px; height:7px; margin-top:4px; flex-shrink:0; }
      .kb-inc-dot.crit { background:var(--crit); box-shadow:0 0 6px var(--crit-bd); }
      .kb-inc-dot.ok { background:var(--green); }
      .kb-inc-main { min-width:0; }
      .kb-inc-service { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); margin-bottom:3px; }
      .kb-inc-desc { font-size:11px; color:var(--t2); line-height:1.5; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .kb-inc-time { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); white-space:nowrap; }
      .kb-inc-chevron { color:var(--t3); font-size:11px; }
      .kb-inc-detail { padding:16px 16px 20px 33px; background:var(--s2); display:flex; flex-direction:column; gap:16px; font-size:13px; }
      .kb-inc-timeline { display:flex; flex-direction:column; gap:8px; }
      .kb-tl-item { display:flex; align-items:center; gap:9px; font-size:11.5px; color:var(--t2); }
      .kb-tl-dot { width:6px; height:6px; background:var(--t3); flex-shrink:0; }
      .kb-tl-dot.ok { background:var(--green); box-shadow:0 0 6px var(--green-bd); }
      .kb-audit { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); padding-top:8px; border-top:0.5px solid var(--bd); }
      .kb-live-tag { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--green); margin-right:10px; }
      .kb-live-dot { width:6px; height:6px; background:var(--green); box-shadow:0 0 6px var(--green); animation:kb-pulse 1.5s ease-in-out infinite; }
      .kb-inc-ns { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; color:var(--t3); background:var(--s3); padding:1px 6px; margin-left:8px; }
      .kb-inc-count { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--crit); align-self:center; white-space:nowrap; }
      .kb-inc-meta-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
      .kb-inline-code { display:inline-block; font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t1); margin-top:3px; }

      /* ---------- incidents v2 — readable cards ---------- */
      .kb-incx-wrap { border-bottom:0.5px solid var(--bd); }
      .kb-incx { display:grid; grid-template-columns:40px 1fr auto; gap:14px; align-items:flex-start; padding:16px 18px; cursor:pointer; transition:background .12s ease; border-left:2px solid transparent; }
      .kb-incx:hover { background:var(--s2); }
      .kb-incx.critical { border-left-color:var(--crit); }
      .kb-incx.warning { border-left-color:#f5b544; }
      .kb-incx-icon { width:34px; height:34px; display:flex; align-items:center; justify-content:center; font-family:var(--font-jetbrains-mono), monospace; font-size:15px; font-weight:600; flex-shrink:0; }
      .kb-incx-icon.critical { color:var(--crit); background:var(--crit-dim); border:0.5px solid var(--crit-bd); }
      .kb-incx-icon.warning { color:#f5b544; background:rgba(245,181,68,0.1); border:0.5px solid rgba(245,181,68,0.3); }
      .kb-incx-body { min-width:0; }
      .kb-incx-title { font-size:14px; font-weight:600; color:var(--t1); letter-spacing:-0.01em; }
      .kb-incx-why { font-size:12.5px; color:var(--t2); line-height:1.5; margin-top:3px; }
      .kb-incx-loc { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
      .kb-loc-chip { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-jetbrains-mono), monospace; font-size:10.5px; color:var(--t1); background:var(--s1); border:0.5px solid var(--bd); padding:3px 8px; }
      .kb-loc-chip .k { color:var(--t3); text-transform:uppercase; letter-spacing:0.05em; font-size:9px; }
      .kb-incx-right { display:flex; flex-direction:column; align-items:flex-end; gap:8px; white-space:nowrap; }
      .kb-crash-badge { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; padding:3px 9px; letter-spacing:0.03em; }
      .kb-crash-badge.critical { color:var(--crit); background:var(--crit-dim); border:0.5px solid var(--crit-bd); }
      .kb-crash-badge.warning { color:#f5b544; background:rgba(245,181,68,0.1); border:0.5px solid rgba(245,181,68,0.3); }
      .kb-incx-meta { display:inline-flex; align-items:center; gap:10px; }
      .kb-incx-cnt { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--crit); }
      .kb-incx-time { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); }
      .kb-incx-detail { padding:18px 18px 22px 22px; background:var(--s2); display:flex; flex-direction:column; gap:16px; border-left:2px solid var(--bd2); }
      .kb-incx-loctable { display:grid; grid-template-columns:repeat(4, 1fr); gap:1px; background:var(--bd); border:0.5px solid var(--bd); }
      .kb-incx-loctable > div { background:var(--s1); padding:11px 13px; display:flex; flex-direction:column; gap:5px; }
      .kb-incx-loctable .k { font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:var(--t3); }
      .kb-incx-loctable code { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); word-break:break-all; }
      .kb-incx-sec { display:flex; flex-direction:column; gap:5px; }
      .kb-explanation.mono { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); background:rgba(0,0,0,0.3); border:0.5px solid var(--bd); padding:9px 11px; }
      @media (max-width:720px) { .kb-incx-loctable { grid-template-columns:repeat(2, 1fr); } .kb-incx { grid-template-columns:34px 1fr; } .kb-incx-right { grid-column:1 / -1; flex-direction:row; align-items:center; } }

      /* ---------- PR risk ---------- */
      .kb-pr-note { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--t2); background:var(--s1); border:0.5px solid var(--bd); padding:10px 14px; }
      .kb-pr-list { display:flex; flex-direction:column; gap:12px; }
      .kb-pr-card { background:var(--s1); border:0.5px solid var(--bd); }
      .kb-pr-card.high { border-color:var(--crit-bd); }
      .kb-pr-card.medium { border-color:rgba(255,184,107,0.3); }
      .kb-pr-card.safe { opacity:0.65; }
      .kb-pr-head { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-pr-title-wrap { flex:1; display:flex; align-items:baseline; gap:8px; min-width:0; }
      .kb-pr-title { font-size:13px; color:var(--t1); }
      .kb-pr-number { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:#7fd3ff; }
      .kb-pr-status { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; letter-spacing:0.05em; padding:3px 8px; white-space:nowrap; }
      .kb-pr-status.high { color:var(--crit); background:var(--crit-dim); }
      .kb-pr-status.medium { color:#ffb86b; background:rgba(255,184,107,0.1); }
      .kb-pr-status.safe { color:var(--green); background:var(--green-dim); }
      .kb-pr-meta { font-family:var(--font-jetbrains-mono), monospace; font-size:10.5px; color:var(--t3); padding:8px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-pr-body { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:14px 16px; border-bottom:0.5px solid var(--bd); }
      .kb-pr-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; }
      .kb-pr-commented { font-size:11px; color:var(--green); }
      .kb-pr-actions { display:flex; gap:8px; margin-left:auto; }

      .kb-risk-badge { font-family:var(--font-jetbrains-mono), monospace; font-size:9px; text-transform:uppercase; padding:3px 8px; border:0.5px solid; }
      .kb-risk-badge.high { background:var(--crit-dim); color:var(--crit); border-color:var(--crit-bd); }
      .kb-risk-badge.medium { background:rgba(255,184,107,0.1); color:#ffb86b; border-color:rgba(255,184,107,0.3); }
      .kb-risk-badge.safe { background:var(--green-dim); color:var(--green); border-color:var(--green-bd); }

      /* ---------- workloads table ---------- */
      .kb-workload-search { max-width:220px; background:var(--s2); border:0.5px solid var(--bd2); padding:7px 12px; color:var(--t1); font-family:var(--font-jetbrains-mono), monospace; font-size:12px; }
      .kb-table-head-row { display:grid; grid-template-columns:1fr 80px 80px 80px 100px 80px; gap:8px; padding:10px 16px; border-bottom:0.5px solid var(--bd); font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--t3); }
      .kb-wl-row { display:grid; grid-template-columns:1fr 80px 80px 80px 100px 80px; gap:8px; padding:12px 16px; border-bottom:0.5px solid var(--bd); align-items:center; cursor:pointer; transition:background .12s ease; }
      .kb-wl-row:hover { background:var(--s2); }
      .kb-wl-service { display:flex; align-items:center; gap:8px; min-width:0; }
      .kb-dot-sm { width:5px; height:5px; flex-shrink:0; }
      .kb-dot-sm.ok { background:var(--green); } .kb-dot-sm.warn { background:#ffb86b; } .kb-dot-sm.crit { background:var(--crit); }
      .kb-wl-name { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); overflow:hidden; text-overflow:ellipsis; }
      .kb-wl-ns { font-size:10px; color:var(--t3); }
      .kb-wl-pods, .kb-wl-metric { font-family:var(--font-jetbrains-mono), monospace; font-size:11px; color:var(--t2); }
      .kb-wl-pods.warn { color:#ffb86b; }
      .kb-tag.red { background:var(--crit-dim); color:var(--crit); border:0.5px solid var(--crit-bd); }
      .kb-tag.amber { background:rgba(255,184,107,0.1); color:#ffb86b; border:0.5px solid rgba(255,184,107,0.3); }

      /* ---------- drawer ---------- */
      .kb-drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:40; }
      .kb-drawer { position:fixed; right:0; top:0; bottom:0; width:360px; background:var(--s1); border-left:0.5px solid var(--bd); z-index:50; display:flex; flex-direction:column; animation:kb-slide-in .2s ease; }
      @keyframes kb-slide-in { from { transform:translateX(100%); } to { transform:translateX(0); } }
      .kb-drawer-head { display:flex; align-items:flex-start; justify-content:space-between; padding:18px 20px; border-bottom:0.5px solid var(--bd); }
      .kb-drawer-title { font-family:var(--font-jetbrains-mono), monospace; font-size:14px; color:var(--t1); }
      .kb-drawer-sub { font-size:11px; color:var(--t3); margin-top:3px; }
      .kb-drawer-close { background:none; border:none; color:var(--t3); font-size:20px; cursor:pointer; line-height:1; }
      .kb-drawer-body { padding:18px 20px; overflow-y:auto; flex:1; }
      .kb-drawer-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:0.5px solid var(--bd); font-size:12.5px; color:var(--t2); }
      .kb-drawer-row span:first-child { color:var(--t3); }
      .kb-warn-text { color:#ffb86b !important; }

      /* ---------- nodes ---------- */
      .kb-node-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px; }
      .kb-node-card { padding:16px; display:flex; flex-direction:column; gap:12px; }
      .kb-node-head { display:flex; align-items:center; gap:8px; }
      .kb-node-name { font-family:var(--font-jetbrains-mono), monospace; font-size:12px; color:var(--t1); flex:1; overflow:hidden; text-overflow:ellipsis; }
      .kb-node-roles { font-size:10px; color:var(--t3); text-transform:uppercase; letter-spacing:0.05em; }
      .kb-node-caps { display:flex; justify-content:space-between; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); padding-top:6px; border-top:0.5px solid var(--bd); }

      /* ---------- ask kubric chat ---------- */
      .kb-ask-screen { display:flex; flex-direction:column; height:100%; }
      .kb-ask-chat { flex:1; overflow-y:auto; padding:28px 24px; display:flex; flex-direction:column; gap:16px; max-width:680px; margin:0 auto; width:100%; }
      .kb-ask-empty { margin:auto; text-align:center; display:flex; flex-direction:column; align-items:center; }
      .kb-ask-hero { position:relative; margin-bottom:22px; display:flex; align-items:center; justify-content:center; }
      .kb-ask-logo { height:72px; width:auto; position:relative; z-index:1; animation:kb-float 4s ease-in-out infinite; }
      @keyframes kb-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
      .kb-ask-hero-glow { position:absolute; width:130px; height:130px; border-radius:50% !important; background:radial-gradient(circle, rgba(124,255,178,0.28), transparent 70%); filter:blur(8px); }
      .kb-ask-empty-title { font-size:18px; color:var(--t1); font-weight:500; margin:0 0 6px; }
      .kb-ask-empty-sub { font-size:13px; color:var(--t3); margin:0 0 24px; max-width:380px; line-height:1.5; }
      .kb-ask-chips { display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:520px; width:100%; }
      .kb-ask-chip { display:flex; align-items:center; gap:10px; background:var(--s2); border:0.5px solid var(--bd); padding:12px 14px; font-size:12.5px; color:var(--t2); cursor:pointer; text-align:left; transition:all .15s ease; }
      .kb-ask-chip:hover { border-color:var(--green-bd); background:var(--green-dim); color:var(--t1); }
      .kb-ask-chip-icon { color:var(--green); font-size:13px; flex-shrink:0; }
      .kb-ask-chip span:nth-child(2) { flex:1; }
      .kb-ask-chip-arrow { color:var(--t3); opacity:0; transition:all .2s ease; }
      .kb-ask-chip:hover .kb-ask-chip-arrow { opacity:1; color:var(--green); transform:translateX(3px); }
      .kb-chat-row { display:flex; gap:10px; align-items:flex-start; }
      .kb-chat-row.kubric { flex-direction:row-reverse; }
      .kb-chat-avatar { width:28px; height:28px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:var(--font-jetbrains-mono), monospace; font-size:9px; overflow:hidden; }
      .kb-chat-avatar.user { background:var(--s3); border:0.5px solid var(--bd2); color:var(--t3); }
      .kb-chat-avatar.kubric { background:var(--green-dim); border:0.5px solid var(--green-bd); }
      .kb-chat-avatar-img { width:20px; height:20px; object-fit:contain; }
      .kb-chat-bubble { background:var(--s2); border:0.5px solid var(--bd); padding:10px 14px; font-size:12.5px; color:var(--t1); max-width:480px; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
      .kb-chat-bubble.kubric { border-left:2px solid var(--green); color:var(--t2); }
      .kb-chat-tag { display:block; font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--green); margin-bottom:6px; }
      .kb-typing { display:inline-flex; gap:4px; }
      .kb-typing span { width:5px; height:5px; background:var(--green); animation:kb-pulse 1.2s ease-in-out infinite; }
      .kb-typing span:nth-child(2) { animation-delay:.2s; } .kb-typing span:nth-child(3) { animation-delay:.4s; }
      .kb-stream-cursor { display:inline-block; width:7px; height:14px; margin-left:2px; background:var(--green); vertical-align:text-bottom; animation:kb-blink 1s step-end infinite; }
      @keyframes kb-blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
      .kb-ask-input-wrap { border-top:0.5px solid var(--bd); padding:16px 24px 20px; }
      .kb-ask-input-inner { max-width:680px; margin:0 auto; display:flex; gap:10px; align-items:center; background:var(--s2); border:0.5px solid var(--bd2); padding:10px 10px 10px 16px; transition:border-color .2s ease; }
      .kb-ask-input-inner:focus-within { border-color:var(--green-bd); }
      .kb-ask-textarea { flex:1; background:transparent; border:none; outline:none; color:var(--t1); font-family:inherit; font-size:13px; resize:none; max-height:120px; line-height:1.5; padding:3px 0; }
      .kb-ask-textarea::placeholder { color:var(--t3); }
      .kb-ask-hint { font-family:var(--font-jetbrains-mono), monospace; font-size:10px; color:var(--t3); white-space:nowrap; flex-shrink:0; }
      .kb-ask-send { display:inline-flex; align-items:center; gap:7px; background:var(--green-dim); border:0.5px solid var(--green-bd); color:var(--green); font-family:inherit; font-size:12.5px; font-weight:500; padding:9px 16px; cursor:pointer; flex-shrink:0; transition:all .15s ease; }
      .kb-ask-send:hover:not(:disabled) { background:rgba(124,255,178,0.18); }
      .kb-ask-send:disabled { opacity:0.4; cursor:not-allowed; }
      .kb-ask-send-arrow { transition:transform .2s ease; }
      .kb-ask-send:hover:not(:disabled) .kb-ask-send-arrow { transform:translateX(3px); }
      .kb-ask-attach { flex-shrink:0; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; background:var(--s3); border:0.5px solid var(--bd2); color:var(--t2); font-size:16px; line-height:1; cursor:pointer; transition:all .15s ease; }
      .kb-ask-attach:hover:not(:disabled) { border-color:var(--green-bd); color:var(--green); background:var(--green-dim); }
      .kb-ask-attach:disabled { opacity:0.4; cursor:not-allowed; }
      .kb-ask-preview { max-width:680px; margin:0 auto 10px; }
      .kb-ask-preview-box { position:relative; display:inline-block; }
      .kb-ask-preview-img { max-height:120px; max-width:220px; display:block; border:0.5px solid var(--green-bd); object-fit:cover; }
      .kb-ask-preview-remove { position:absolute; top:-8px; right:-8px; width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; background:var(--s1); border:0.5px solid var(--bd2); color:var(--t2); font-size:10px; cursor:pointer; transition:all .15s ease; }
      .kb-ask-preview-remove:hover { border-color:var(--green-bd); color:var(--green); }
      .kb-chat-image { display:block; max-width:100%; max-height:260px; margin-bottom:8px; border:0.5px solid var(--bd2); object-fit:contain; }

      /* ---------- playbooks ---------- */
      .kb-playbook-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; }
      .kb-playbook-card { padding:20px; cursor:pointer; }
      .kb-playbook-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .kb-playbook-source { font-size:10px; color:var(--t3); }
      .kb-playbook-title { font-size:14px; color:var(--t1); margin:0 0 8px; font-weight:500; }
      .kb-playbook-desc { font-size:12px; color:var(--t2); line-height:1.55; margin:0 0 16px; }
      .kb-playbook-foot { display:flex; justify-content:space-between; font-size:10px; color:var(--t3); }
      .kb-playbook-running { color:var(--green); display:flex; align-items:center; gap:6px; }

      /* ---------- settings ---------- */
      .kb-settings-grid { display:grid; grid-template-columns:180px 1fr; gap:20px; align-items:start; }
      .kb-settings-nav { display:flex; flex-direction:column; gap:2px; }
      .kb-settings-content { min-width:0; }
      .kb-trust-card { display:flex; gap:14px; padding:16px; border:0.5px solid var(--bd); cursor:pointer; margin-bottom:10px; }
      .kb-trust-card.selected { border-color:var(--green-bd); background:var(--green-dim); }
      .kb-radio { width:15px; height:15px; border-radius:50% !important; border:1.5px solid var(--bd2); flex-shrink:0; margin-top:2px; }
      .kb-radio.on { border-color:var(--green); box-shadow:inset 0 0 0 3px var(--green); }
      .kb-trust-name { font-size:13px; color:var(--t1); font-weight:500; margin-bottom:4px; }
      .kb-trust-desc { font-size:11.5px; color:var(--t2); line-height:1.5; }
      .kb-issue-toggles { border-top:0.5px solid var(--bd); padding-top:6px; }
      .kb-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; font-size:12.5px; color:var(--t2); }
      .kb-switch { width:32px; height:18px; background:var(--s3); border:none; position:relative; cursor:pointer; }
      .kb-switch.on { background:var(--green-dim); border:0.5px solid var(--green-bd); }
      .kb-switch-knob { position:absolute; top:2px; left:2px; width:12px; height:12px; background:var(--t3); transition:left .15s ease, background .15s ease; }
      .kb-switch.on .kb-switch-knob { left:18px; background:var(--green); }

      /* ---------- command palette ---------- */
      .kb-cmdk-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:100; display:flex; }
      .kb-cmdk { max-width:560px; width:90%; margin:80px auto 0; background:var(--s1); border:0.5px solid var(--bd2); height:fit-content; max-height:70vh; display:flex; flex-direction:column; }
      .kb-cmdk-input { height:44px; padding:0 16px; background:transparent; border:none; outline:none; color:var(--t1); font-size:14px; border-bottom:0.5px solid var(--bd); font-family:inherit; }
      .kb-cmdk-results { overflow-y:auto; max-height:360px; }
      .kb-cmdk-item { padding:10px 16px; display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; color:var(--t1); }
      .kb-cmdk-item:hover, .kb-cmdk-item.selected { background:var(--green-dim); }
      .kb-cmdk-icon { color:var(--t3); width:16px; text-align:center; }
      .kb-cmdk-empty { padding:20px 16px; color:var(--t3); font-size:12px; text-align:center; }

      @media (max-width: 860px) {
        .kb-pr-body { grid-template-columns:1fr; }
        .kb-settings-grid { grid-template-columns:1fr; }
        .kb-table-head-row, .kb-wl-row { grid-template-columns:1fr 60px 60px; }
        .kb-table-head-row span:nth-child(4), .kb-table-head-row span:nth-child(5), .kb-table-head-row span:nth-child(6),
        .kb-wl-row .kb-wl-metric:nth-of-type(2), .kb-wl-row .kb-tag, .kb-wl-row .kb-risk-badge { display:none; }
        .kb-ask-chips { grid-template-columns:1fr; }
      }
    `}} />
  );
}
