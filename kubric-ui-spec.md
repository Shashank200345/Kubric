# Kubric — Complete UI/UX Specification

> This document is the single source of truth for building the Kubric platform UI from scratch.
> Every screen, component, interaction, color, and spacing decision is defined here.
> Hand this file directly to any AI IDE (Cursor, Windsurf, Claude Code, Copilot) to generate the full frontend.

---

## Table of Contents

1. [Product Context](#1-product-context)
2. [Design Philosophy](#2-design-philosophy)
3. [Design System — Tokens](#3-design-system--tokens)
4. [Layout Architecture](#4-layout-architecture)
5. [Component Library](#5-component-library)
6. [Screen 1 — Overview](#6-screen-1--overview)
7. [Screen 2 — Incidents](#7-screen-2--incidents)
8. [Screen 3 — PR Risk](#8-screen-3--pr-risk)
9. [Screen 4 — Workloads](#9-screen-4--workloads)
10. [Screen 5 — Ask Kubric](#10-screen-5--ask-kubric)
11. [Screen 6 — Playbooks](#11-screen-6--playbooks)
12. [Screen 7 — Settings](#12-screen-7--settings)
13. [Interactions & Animations](#13-interactions--animations)
14. [Responsive Behaviour](#14-responsive-behaviour)
15. [Tech Stack & File Structure](#15-tech-stack--file-structure)
16. [Implementation Prompt](#16-implementation-prompt)

---

## 1. Product Context

**Kubric** is an AI-powered Kubernetes troubleshooting and pre-deployment intelligence platform.

**What it does:**
- Installs a lightweight agent inside customer Kubernetes clusters
- Watches resource usage, pod events, and deployment history in real time
- Analyses open GitHub PRs and posts risk assessments before deployment
- Detects incidents, finds root causes, and suggests or applies fixes
- Provides a conversational interface for engineers to query cluster state in plain English

**Primary user:** A DevOps engineer or SRE who is either calmly monitoring their cluster or actively debugging a production incident at 3am. The UI must serve both states equally well.

**Design goal:** The platform should feel like a command-center meets a code editor — not a BI dashboard. Think Linear meets Vercel meets a terminal. Information-dense but not cluttered. Every pixel must earn its place.

---

## 2. Design Philosophy

### Core Principles

**Show meaning, not metrics.**
Do not show raw CPU/memory graphs as the primary content. Show what those numbers mean — "OOMKill in ~4 min if this PR merges" is more useful than a memory usage graph. Graphs appear only as supporting detail, never as the main content.

**Two modes: calm and panic.**
When an engineer is calm (browsing), give them confidence — cluster health score, clean incident list, PR risk summary. When they are panicking (active incident), get out of their way — surface the root cause, the fix, and the one-click apply button immediately. No navigation required.

**Actions over information.**
Every screen should have a clear primary action. Incident screen → Apply fix. PR Risk screen → Comment on PR. Ask Kubric screen → Send message. Never leave the engineer in an informational dead end.

**Trust is earned progressively.**
The fix workflow has three modes that are always visible: Suggest (show only), Approve (show + one-click apply), Auto-fix (applied automatically). The engineer sees which mode is active and can change it in Settings.

### What this UI is NOT
- Not a Grafana replacement — no time-series graph dashboards
- Not an alert management tool — no alert routing rules or on-call schedules
- Not a log viewer — no raw log tailing interface
- Not a Kubernetes dashboard — no YAML editor for arbitrary resources

---

## 3. Design System — Tokens

### Color Palette

Define these as CSS custom properties on `:root`. The UI is **dark-first**. There is no light mode in v1.

```css
:root {
  /* Backgrounds */
  --bg:       #07090C;   /* page background — deepest level */
  --s1:       #0D1117;   /* surface 1 — sidebar, topbar, cards */
  --s2:       #111820;   /* surface 2 — nested cards, code blocks */
  --s3:       #19222E;   /* surface 3 — hover states, tags */

  /* Borders */
  --bd:       rgba(255, 255, 255, 0.07);   /* default hairline border */
  --bd2:      rgba(255, 255, 255, 0.12);   /* emphasized border */
  --bd3:      rgba(255, 255, 255, 0.20);   /* strong border, focus */

  /* Brand — Teal (primary) */
  --teal:     #00C9A7;
  --teal-dim: rgba(0, 201, 167, 0.12);
  --teal-glow:rgba(0, 201, 167, 0.25);
  --teal-bd:  rgba(0, 201, 167, 0.30);

  /* Semantic — Red (critical/error) */
  --red:      #F85149;
  --red-dim:  rgba(248, 81, 73, 0.12);
  --red-bd:   rgba(248, 81, 73, 0.30);

  /* Semantic — Amber (warning/medium) */
  --amber:    #E3B341;
  --amber-dim:rgba(227, 179, 65, 0.12);
  --amber-bd: rgba(227, 179, 65, 0.30);

  /* Semantic — Blue (info/links) */
  --blue:     #58A6FF;
  --blue-dim: rgba(88, 166, 255, 0.10);

  /* Semantic — Purple (AI/Kubric responses) */
  --purple:   #BC8CFF;
  --purple-dim:rgba(188, 140, 255, 0.10);

  /* Text */
  --t1:  rgba(255, 255, 255, 0.92);   /* primary text */
  --t2:  rgba(255, 255, 255, 0.50);   /* secondary text */
  --t3:  rgba(255, 255, 255, 0.25);   /* muted text, labels */
  --t4:  rgba(255, 255, 255, 0.10);   /* disabled, placeholders */

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* Spacing scale */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;

  /* Border radius */
  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 8px;
  --r-xl: 12px;
}
```

### Typography Scale

| Role | Font | Size | Weight | Color | Usage |
|------|------|------|--------|-------|-------|
| `page-title` | Inter | 15px | 500 | `--t1` | Screen headings |
| `section-label` | Inter | 11px | 500 | `--t2` | Column headers, uppercase + tracking |
| `body` | Inter | 13px | 400 | `--t1` | General text |
| `body-sm` | Inter | 12px | 400 | `--t2` | Supporting text, descriptions |
| `caption` | Inter | 11px | 400 | `--t2` | Tags, metadata |
| `micro` | Inter | 10px | 400 | `--t3` | Labels, timestamps, eyebrows |
| `mono-body` | JetBrains Mono | 12px | 400 | `--t1` | Service names, code, values |
| `mono-sm` | JetBrains Mono | 11px | 400 | `--t2` | Inline code, YAML snippets |
| `mono-xs` | JetBrains Mono | 10px | 400 | `--t3` | Timestamps, commit hashes |

**Rules:**
- Service names and technical identifiers always use `--font-mono`
- Section labels are always `text-transform: uppercase; letter-spacing: 0.07em`
- Never go below 10px font size
- No font weight above 500 anywhere in the UI (the dark background does the visual work)

---

## 4. Layout Architecture

### Shell Grid

The entire app renders inside a CSS Grid shell. This shell does not scroll — it fills the viewport. Internal panels scroll independently.

```
┌────────────────────────────────────────────────────┐
│                    TOPBAR (40px)                    │  ← grid-column: 1 / -1
├──────────────┬─────────────────────────────────────┤
│              │                                     │
│   SIDEBAR    │           MAIN AREA                 │
│   (200px)    │        (fills remaining)            │
│              │                                     │
│              │                                     │
└──────────────┴─────────────────────────────────────┘
```

```css
.shell {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: 40px 1fr;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}
```

The `.main` area is `overflow-y: auto` and contains the active screen. Only one screen renders at a time (others are `display: none`). Do NOT use client-side routing for v1 — use CSS display toggling with JavaScript `switchScreen(name)`.

### Main Area Internal Structure

Most screens follow this internal structure:

```
┌───────────────────────────────────────────────────┐
│  SCREEN SELECTOR BAR  (40px, top of main)         │
├───────────────────────────────────────────────────┤
│  PAGE HEADER  (56px, title + subtitle + actions)  │
├───────────────────────────────────────────────────┤
│  STAT ROW  (68px, 4 metric cells)                 │
├──────────────────────────┬────────────────────────┤
│                          │                        │
│   LEFT COLUMN            │   RIGHT COLUMN         │
│   (fills 1fr)            │   (340px fixed)        │
│   incident feed /        │   detail panel /       │
│   workload table /       │   AI output /          │
│   PR list                │   fix block            │
│                          │                        │
└──────────────────────────┴────────────────────────┘
```

Not all screens use the two-column layout. See per-screen specs below.

---

## 5. Component Library

Document every reusable component here. Build these first before building screens.

---

### 5.1 Topbar

**Height:** 40px  
**Background:** `var(--s1)`  
**Border:** `border-bottom: 0.5px solid var(--bd)`  
**Layout:** `display: flex; align-items: center; padding: 0 16px; gap: 12px`

**Left section (left to right):**
1. **Logo** — `kubric` in `--font-mono`, 13px, `--teal` color
2. **Divider** — `0.5px` wide, 16px tall, `var(--bd2)` color
3. **Cluster picker** — pill button: `6px pulse-dot` + cluster name + chevron-down icon. Background `var(--s2)`, border `0.5px var(--bd)`, padding `3px 8px`, radius `var(--r-md)`. On click: opens a dropdown listing connected clusters.

**Right section (margin-left: auto, flex row, gap 8px):**
1. **Search bar** — `display: flex; align-items: center; gap: 6px`. Background `var(--s2)`, border `0.5px var(--bd)`, radius `var(--r-md)`, padding `4px 10px`. Content: search icon (14px, `--t3`) + placeholder text "Search or ask anything..." (11px mono, `--t3`) + keyboard shortcut badge "⌘K" (9px, `--s3` background, `--t3` color). On click: opens the Command Palette (see 5.11).
2. **Notification bell** — 22×22px container. Bell icon 14px `--t3`. Red badge dot (7px, `--red` background, `1.5px --s1` border) positioned `top: 2px; right: 2px` when there are unread alerts.
3. **Avatar** — 22×22px circle. Background `var(--teal-dim)`, border `0.5px var(--teal-bd)`. Content: user initials, 9px `--font-mono`, `--teal` color.

---

### 5.2 Sidebar

**Width:** 200px  
**Background:** `var(--s1)`  
**Border:** `border-right: 0.5px solid var(--bd)`  
**Layout:** `display: flex; flex-direction: column; padding: 12px 0; gap: 2px; overflow-y: auto`

**Section label** (`.nav-section`):
- `padding: 0 12px; margin: 8px 0 4px`
- Font: 9px Inter, uppercase, `letter-spacing: 0.1em`, `--t3` color

**Nav item** (`.nav-item`):
- `display: flex; align-items: center; gap: 8px; padding: 6px 12px; margin: 0 6px; border-radius: var(--r-md); cursor: pointer`
- Icon: 14px Tabler outline icon, fixed `width: 16px; text-align: center`
- Label: 12px Inter, `--t2`
- Default state: transparent background
- Hover state: `background: rgba(255,255,255,0.06); color: var(--t1)`
- Active state: `background: var(--teal-dim); color: var(--teal)`
- Badge (optional): right-aligned pill — 9px mono text. Colors: red for errors, amber for warnings, teal for info.

**Navigation structure:**

```
MONITOR
  Overview          [ti-layout-dashboard]
  Incidents         [ti-alert-triangle]   badge: red count
  PR Risk           [ti-git-pull-request] badge: amber count

CLUSTER
  Workloads         [ti-server-2]
  Nodes             [ti-topology-star]
  Resources         [ti-activity]

AUTOMATE
  Playbooks         [ti-book-2]           badge: teal count
  History           [ti-history]
  Ask Kubric        [ti-message-dots]

(bottom, separated by border-top)
  Settings          [ti-settings]
```

**Footer:** `margin-top: auto; padding-top: 12px; border-top: 0.5px solid var(--bd)`

---

### 5.3 Screen Selector Bar

Appears at the top of every screen's main area. Allows quick switching between screens without using the sidebar. This is for discoverability — power users use the sidebar; new users use this bar.

**Height:** 40px  
**Background:** `var(--s2)`  
**Border:** `border-bottom: 0.5px solid var(--bd)`  
**Layout:** `display: flex; gap: 6px; padding: 8px 16px; flex-wrap: wrap; align-items: center`

**Screen button** (`.screen-btn`):
- `padding: 4px 10px; border-radius: var(--r-sm); font-size: 10px; font-family: var(--font-mono); border: 0.5px solid var(--bd); background: transparent; color: var(--t3); cursor: pointer`
- Active state: `background: var(--teal-dim); border-color: var(--teal-bd); color: var(--teal)`

---

### 5.4 Page Header

Sits below the screen selector bar on every screen.

**Height:** ~56px (auto, padding-based)  
**Padding:** `20px 24px 16px`  
**Border:** `border-bottom: 0.5px solid var(--bd)`  
**Layout:** `display: flex; align-items: center; justify-content: space-between`

**Left:**
- `.page-title` — 15px Inter 500, `--t1`
- `.page-sub` — 11px mono, `--t3`, margin-top 2px. Format: `cluster-name · last synced Xs ago`

**Right:**
- Row of small buttons. See Button component (5.7).

---

### 5.5 Stat Row

A 4-cell metrics strip. Appears on Overview, Incidents, and Workloads screens.

**Layout:** `display: grid; grid-template-columns: repeat(4, 1fr); background: var(--bd); gap: 1px; border-bottom: 0.5px solid var(--bd)`

Each cell (`.stat-cell`):
- `background: var(--s1); padding: 16px 20px`
- `.stat-label` — 10px Inter, uppercase, `letter-spacing: 0.08em`, `--t3`, margin-bottom 6px
- `.stat-val` — 22px mono 500, `--t1`, `line-height: 1`. Colors: default `--t1`, green/healthy `--teal`, warning `--amber`, critical `--red`
- Secondary value (e.g. `/148`): 13px, `--t3`, inline after main value
- `.stat-meta` — 10px Inter, `--t3`, margin-top 4px. Supporting context.

---

### 5.6 Incident Item

Used in the incident feed (left column of Overview and Incidents screens).

**Layout:** `display: grid; grid-template-columns: 10px 1fr auto; gap: 10px; align-items: flex-start; padding: 14px 16px; border-bottom: 0.5px solid var(--bd); cursor: pointer`

**Left column — status dot** (`.inc-dot`):
- `width: 7px; height: 7px; border-radius: 50%; margin-top: 4px; flex-shrink: 0`
- Colors and glow:
  - Critical: `background: var(--red); box-shadow: 0 0 6px rgba(248,81,73,0.5)` + pulse animation
  - Warning: `background: var(--amber)` (no glow)
  - Resolved: `background: var(--teal)` (no glow)
  - Inactive: `background: var(--t3)` (no glow)

**Middle column:**
- `.inc-service` — 12px mono 500, `--t1`, margin-bottom 3px. Always the service name (e.g. `payment-service`)
- `.inc-desc` — 11px Inter, `--t2`, `line-height: 1.5`. One to two sentences, plain English.
- `.inc-tags` — `display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap`. Tags are 9px mono pills.

**Right column:**
- `.inc-time` — 10px mono, `--t3`, `white-space: nowrap`. Relative time (e.g. "2m ago")

**States:**
- Default: transparent background
- Hover: `background: rgba(255,255,255,0.04)`
- Active/selected: `background: var(--s2); border-left: 2px solid var(--red)` (shifts content slightly right)
- Warning active: `border-left: 2px solid var(--amber)`
- Resolved: `opacity: 0.5`

**Tag colors** (`.inc-tag`):
- `font-size: 9px; font-family: var(--font-mono); padding: 1px 5px; border-radius: var(--r-sm)`
- `.red` — `background: var(--red-dim); color: var(--red)`
- `.amber` — `background: var(--amber-dim); color: var(--amber)`
- `.blue` — `background: var(--blue-dim); color: var(--blue)`
- `.gray` — `background: var(--s3); color: var(--t3)`
- `.teal` — `background: var(--teal-dim); color: var(--teal)`

---

### 5.7 Buttons

**Small button** (`.btn-sm`) — used in page headers:
```css
.btn-sm {
  padding: 5px 12px;
  border-radius: var(--r-md);
  font-size: 11px;
  border: 0.5px solid var(--bd2);
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.btn-sm:hover { background: var(--s3); color: var(--t1); }
.btn-sm.primary {
  background: var(--teal-dim);
  border-color: var(--teal-bd);
  color: var(--teal);
}
```

**Fix buttons** — used in detail panels:
```css
.fix-btn {
  flex: 1;
  padding: 7px;
  border-radius: var(--r-md);
  font-size: 11px;
  border: 0.5px solid;
  cursor: pointer;
  text-align: center;
}
.fix-btn.apply {
  background: var(--teal-dim);
  border-color: rgba(0,201,167,0.4);
  color: var(--teal);
}
.fix-btn.preview {
  background: transparent;
  border-color: var(--bd2);
  color: var(--t2);
}
```

**Risk badge** (`.risk-badge`):
```css
.risk-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  padding: 2px 6px;
  border-radius: var(--r-sm);
  font-weight: 500;
}
.risk-badge.high   { background: var(--red-dim);   color: var(--red);   border: 0.5px solid var(--red-bd); }
.risk-badge.medium { background: var(--amber-dim); color: var(--amber); border: 0.5px solid var(--amber-bd); }
.risk-badge.safe   { background: var(--teal-dim);  color: var(--teal);  border: 0.5px solid var(--teal-bd); }
```

---

### 5.8 Column Header

Used above every list or column that needs a label + optional controls.

```css
.col-header {
  padding: 10px 16px;
  border-bottom: 0.5px solid var(--bd);
  display: flex;
  align-items: center;
  gap: 8px;
}
.col-header-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--t2);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.col-header-count {
  background: var(--s3);
  color: var(--t3);
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: var(--r-sm);
}
```

Optional right-aligned filter pills:
```css
.filter-pill {
  padding: 2px 8px;
  border-radius: var(--r-sm);
  font-size: 10px;
  border: 0.5px solid var(--bd);
  color: var(--t3);
  cursor: pointer;
  background: transparent;
}
.filter-pill.active {
  background: var(--teal-dim);
  border-color: var(--teal-bd);
  color: var(--teal);
}
```

---

### 5.9 Detail Panel

The right column on the Overview screen. Fixed 340px wide. Contains the full incident detail for the selected incident item. Scrollable independently.

**Sections (top to bottom, each separated by `border-bottom: 0.5px solid var(--bd)`):**

#### Service Header
- Service name in mono 13px 500 `--t1` + inline status badge
- Status badge: `display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: var(--r-sm); font-size: 9px; font-family: var(--font-mono)`
  - Critical: `background: var(--red-dim); color: var(--red); border: 0.5px solid var(--red-bd)`
  - Warning: `background: var(--amber-dim); color: var(--amber); border: 0.5px solid var(--amber-bd)`
- Meta row: `display: flex; gap: 12px; flex-wrap: wrap`. Each meta item: 10px, `--t3`, with a 11px Tabler icon. Format: icon + label (e.g. version, uptime, pod count)
- Sparkline SVG: 32px tall, full width, `margin-top: 10px`. Shows the relevant metric (memory/CPU) over the last 30 minutes as a polyline. Color: `--red` for critical metrics. Add a vertical dashed line at the deploy event with a "deploy" text label.
- Sparkline label: 9px mono, `--t3`, "memory usage · last 30 min"

#### Tabs
- `display: flex; border-bottom: 0.5px solid var(--bd); padding: 0 16px`
- Each tab: `padding: 8px 12px; font-size: 11px; cursor: pointer; border-bottom: 1.5px solid transparent; margin-bottom: -0.5px`
- Active tab: `color: var(--teal); border-bottom-color: var(--teal)`
- Default tab: `color: var(--t3)`
- Tabs: "Root cause" | "Fix" | "History"

#### Root Cause Block
- Label: 9px uppercase mono, `--t3`, "KUBRIC DIAGNOSIS"
- Finding card: `background: var(--s2); border: 0.5px solid var(--bd); border-left: 2px solid var(--red); border-radius: 0 var(--r-md) var(--r-md) 0; padding: 10px 12px`
  - Text: 11px mono, `--t2`, `line-height: 1.65`
  - Key values (service name, versions, memory numbers): `color: var(--t1)` or `color: var(--red)` for dangerous values
- Confidence row: flex row with a progress bar + percentage label
  - Bar: `height: 3px; background: var(--s3); border-radius: 2px; overflow: hidden`
  - Fill: `background: var(--teal)` at width = confidence %
  - Label: 10px mono, `--teal`

#### Fix Block
- Label: 9px uppercase mono, `--t3`, "SUGGESTED FIX"
- Code block: `background: var(--bg); border: 0.5px solid var(--bd); border-radius: var(--r-md); padding: 10px 12px; font-family: var(--font-mono); font-size: 10px; line-height: 1.8`
  - YAML keys: `color: var(--blue)`
  - YAML values: `color: var(--amber)`
  - Deleted lines: `color: var(--red); text-decoration: line-through; opacity: 0.6`
  - Added lines: `color: var(--teal)`
  - Comments: `color: var(--t3)`
- Action row: two `.fix-btn` buttons side by side — "Apply fix now" (`.apply`) + "Preview YAML" (`.preview`)

#### PR Risk Summary (at bottom of right panel)
- Column header: "OPEN PRs — RISK ASSESSED"
- One PR item per open PR:
  - `background: var(--s2); border: 0.5px solid var(--bd); border-radius: var(--r-md); padding: 10px 12px; margin-bottom: 8px`
  - Header: `display: flex; align-items: center; gap: 6px` — risk badge + PR title (11px, `--t1`)
  - Description: 10px mono, `--t2`, `line-height: 1.55`
  - Link: 10px, `--blue`, flex row with external-link icon — "View on GitHub"

---

### 5.10 Code Block

Used anywhere YAML, kubectl commands, or technical output appears.

```css
.code-block {
  background: var(--bg);
  border: 0.5px solid var(--bd);
  border-radius: var(--r-md);
  padding: 10px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.8;
  overflow-x: auto;
}
```

Syntax coloring:
- YAML keys: `var(--blue)`
- YAML values / strings: `var(--amber)`
- Deleted (old value): `var(--red)` + `text-decoration: line-through` + `opacity: 0.6`
- Added (new value): `var(--teal)`
- Comments (`#`): `var(--t3)`
- Command prompts (`$`): `var(--teal)`
- Command text: `var(--t1)`
- Output text: `var(--t2)`

---

### 5.11 Command Palette

Triggered by clicking the search bar in the topbar or pressing `⌘K` / `Ctrl+K`.

**Overlay:** full-screen backdrop `background: rgba(0,0,0,0.6)`. Do NOT use `position: fixed` — wrap in a full-viewport div in normal document flow.

**Palette container:** `max-width: 560px; margin: 80px auto; background: var(--s1); border: 0.5px solid var(--bd2); border-radius: var(--r-xl)`

**Input:** full-width text input, 40px tall, `font-size: 14px`, `background: transparent`, no border (the container has the border), `padding: 0 16px`. Placeholder: "Search services, ask Kubric, run a command..."

**Border below input:** `0.5px solid var(--bd)`

**Results list:** `max-height: 360px; overflow-y: auto`

**Result item:** `padding: 10px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer`
- Icon: 16px Tabler icon, `--t3`
- Label: 13px, `--t1`
- Sublabel: 11px, `--t3`
- Hover: `background: var(--s2)`
- Selected: `background: var(--teal-dim)`

**Result categories:** Services, Recent incidents, Commands (e.g. "Deploy rollback"), Ask Kubric (free-form query)

**Keyboard navigation:** Arrow keys to move, Enter to select, Escape to close.

---

### 5.12 Pulse Animation

Used on active/critical dots and the cluster indicator in the topbar.

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}
.pulse { animation: pulse 2s ease-in-out infinite; }
```

Only apply to status dots that represent an ACTIVE ongoing incident. Resolved, warning-level, and healthy dots do not pulse.

---

### 5.13 Sparkline SVG

A minimal inline SVG time-series indicator. Not a full chart — a glanceable shape.

- `viewBox="0 0 280 32"`, `width: 100%; height: 32px`
- Single `<polyline>` with `fill: none`, stroke color matching the metric severity, `stroke-width: 1.5`, `stroke-linecap: round; stroke-linejoin: round`
- For deploy events: vertical `<line>` at the event timestamp, `stroke-dasharray: 3 2`, `opacity: 0.4` + small text label
- No axes, no grid lines, no numbers — the sparkline is decorative context only

---

## 6. Screen 1 — Overview

**Route:** `/` or `/overview`  
**Sidebar active item:** Overview

### Purpose
The landing screen. Gives the engineer a full picture of cluster health at a glance. If something is wrong, they should see it within 3 seconds of opening the app.

### Layout
Uses the full two-column layout with stat row.

```
Screen selector bar
Page header: "Cluster Overview" | subtitle: "production-mumbai · last synced 12s ago" | actions: [Sync] [Ask Kubric →]
Stat row (4 cells)
Two-column content:
  Left (1fr):  Incident feed
  Right (340px): Detail panel
```

### Stat Row Values
| Cell | Label | Value | Color rule |
|------|-------|-------|------------|
| 1 | Health score | 0–100 integer | < 60 = red, 60–79 = amber, ≥ 80 = teal |
| 2 | Active incidents | Count | 0 = teal, > 0 = red |
| 3 | Pods running | `X/Total` | X < Total = amber/red |
| 4 | PRs pending review | Count | 0 = teal, > 0 = amber |

Below each stat value: a `.stat-meta` line with supporting context (e.g. "2 critical · 1 warning").

### Left Column — Incident Feed

**Column header:** "LIVE INCIDENTS" + count badge + filter pills (All | Critical | Warning)

**Section: Active incidents**
Render active incident items (critical first, then warning). See 5.6 for incident item spec.

The first incident is selected by default (`.active` class) — its detail appears in the right column.

Clicking any incident selects it and updates the right panel. No page navigation — this is a single-page panel update.

**Section: Resolved today**
Separate column header: "RESOLVED TODAY" + count badge

Resolved incidents use `opacity: 0.5` and the teal dot. No glow. No pulse.

### Right Column — Detail Panel

See 5.9 for full detail panel spec.

**Default state:** Show the most critical active incident.

**On incident selection:** Animate the panel update with `transition: opacity 0.2s`. Briefly fade to 0 opacity then back to 1 as content swaps.

---

## 7. Screen 2 — Incidents

**Route:** `/incidents`  
**Sidebar active item:** Incidents

### Purpose
Full incident history. All open and resolved incidents. Each incident has a complete timeline, RCA, fix record, and audit trail.

### Layout
```
Screen selector bar
Page header: "All Incidents" | subtitle | actions: [Export] [Filter]
Stat row: [Open] [MTTD avg] [MTTF avg] [Auto-fixed today]
Full-width incident list (no right panel on this screen)
```

### Incident List (full width)

Same incident item component as Overview, but wider (no 340px right column). On click: expand inline below the incident row (accordion pattern) showing the full detail — RCA, timeline, fix applied, who approved it.

**Expanded incident detail (accordion):**
- `border-left: 2px solid var(--red); margin-left: 10px; padding: 16px; background: var(--s2)`
- Timeline sub-section: vertical list of timestamped events (deploy triggered → pods started crashing → Kubric detected → fix suggested → fix applied)
- RCA block (same as detail panel)
- Fix block (same as detail panel, but read-only if already resolved)
- Audit row: "Fixed by Kubric (auto) · approved by @user · 14:32 IST"

**Filter bar** (above the list):
- `display: flex; gap: 8px; padding: 12px 16px; border-bottom: 0.5px solid var(--bd)`
- Pills: All | Open | Resolved | Auto-fixed | Critical | Warning
- Date range picker (simple: Today | Last 7 days | Last 30 days)

---

## 8. Screen 3 — PR Risk

**Route:** `/pr-risk`  
**Sidebar active item:** PR Risk

### Purpose
Shows all open PRs that Kubric has analysed. Each PR shows the risk level, what will break, and why — before the engineer merges.

### Layout
```
Screen selector bar
Page header: "PR Risk Assessments" | subtitle: "Kubric has analysed N PRs this week · N flagged"
Full-width PR list (no stat row, no right panel)
```

### PR Item Card

Each PR is a card: `background: var(--s1); border-radius: var(--r-lg); overflow: hidden; margin-bottom: 12px`

Card border color by risk:
- HIGH: `border: 0.5px solid var(--red-bd)`
- MEDIUM: `border: 0.5px solid var(--amber-bd)`
- SAFE: `border: 0.5px solid var(--bd)` with `opacity: 0.7`

**Card header section** (`padding: 14px 16px; border-bottom: 0.5px solid var(--bd); display: flex; align-items: flex-start; gap: 12px`):
- Risk badge (left-aligned, `flex-shrink: 0`, margin-top 2px)
- PR title (12px 500 `--t1`) + PR number (10px mono `--blue`) in `flex: 1`
- Status pill (right side): HIGH → "will break" in red, MEDIUM → "review needed" in amber, SAFE → "clear to merge" in teal

**PR metadata:** `font-size: 11px; color: var(--t3); font-family: var(--font-mono); margin-top: 3px` — "opened by @username · time ago · branch info"

**Card body section** (`padding: 14px 16px; border-bottom: 0.5px solid var(--bd); display: grid; grid-template-columns: 1fr 1fr; gap: 12px`):

Left cell — "What changed":
- Label: 9px uppercase, `--t3`
- Code block showing the diff (deleted + added lines, YAML format)

Right cell — "Why it will break":
- Label: 9px uppercase, `--t3`
- Mono text: P95 usage, P99 usage, new limit, outcome prediction. Color P-values red if they exceed new limit.

**Card footer** (`padding: 10px 16px; display: flex; align-items: center; gap: 8px`):
- "Kubric commented on PR" + teal checkmark (if already commented)
- Right-aligned action buttons: "View PR" (ghost) + "Suggest fix on PR" (teal, if HIGH risk)

**SAFE PRs** are rendered in a collapsed/dimmed state. No body section. Just header with "clear to merge" badge.

---

## 9. Screen 4 — Workloads

**Route:** `/workloads`  
**Sidebar active item:** Workloads

### Purpose
A scannable table of every workload (Deployment, StatefulSet, DaemonSet) in the cluster. Quick health check across all services.

### Layout
```
Screen selector bar
Page header: "Workloads" | namespace filter dropdown | search input
Full-width table
```

### Table

**Table header row:** `display: grid; grid-template-columns: 1fr 80px 80px 80px 90px 80px; gap: 8px; padding: 10px 16px; border-bottom: 0.5px solid var(--bd); font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--t3)`

Columns: Service | Pods | CPU | Memory | Status | Risk

**Table row (each workload):** Same grid, `padding: 10px 16px; border-bottom: 0.5px solid var(--bd); cursor: pointer; align-items: center`

Row hover: `background: rgba(255,255,255,0.03)`

Column content:
- **Service** — `display: flex; align-items: center; gap: 6px`. Status dot (5px circle, color = health) + service name (11px mono `--t1`)
- **Pods** — `font-size: 11px; font-family: var(--font-mono)`. Color: all healthy = `--t1`, partial = `--amber`, 0 running = `--red`
- **CPU** — 11px mono, `--t2`. Percentage. Amber if > 80%, red if > 95%
- **Memory** — 11px mono. Color: amber if > 80% of limit, red if > 95% or OOMKilling
- **Status** — small tag badge (same as `.inc-tag`)
- **Risk** — risk badge (same as `.risk-badge`)

Clicking a row opens the detail panel in a right drawer (340px, same as Overview right panel but as a slide-in overlay from the right). The drawer contains the full service detail: RCA if incident exists, resource usage chart, recent events, fix block.

**Drawer:**
- `position: absolute; right: 0; top: 0; bottom: 0; width: 340px; background: var(--s1); border-left: 0.5px solid var(--bd); z-index: 50`
- Slide in from right: `transform: translateX(100%)` → `transform: translateX(0)` with `transition: transform 0.2s ease`
- Close button: `×` in top-right corner

---

## 10. Screen 5 — Ask Kubric

**Route:** `/ask`  
**Sidebar active item:** Ask Kubric

### Purpose
A conversational interface. Engineers type plain-English questions about their cluster and get AI-powered answers grounded in real cluster data.

### Layout
```
Screen selector bar
Chat area (scrollable, flex: 1)
Input area (fixed at bottom, ~56px)
```

No page header. No stat row. No columns. The entire screen is the chat.

### Chat Area

`display: flex; flex-direction: column; padding: 24px; gap: 16px; overflow-y: auto; max-width: 680px; margin: 0 auto; width: 100%`

**Empty state** (no messages yet):
- Centered vertically. Title: "Ask anything about your cluster" (13px 500, `--t2`)
- Below: 4 suggestion chips in a 2×2 grid. Each chip: `background: var(--s2); border: 0.5px solid var(--bd); border-radius: var(--r-lg); padding: 10px 14px; font-size: 12px; color: var(--t2); cursor: pointer`
- Suggestions: "Why is payment-service crashing?" | "Is the cluster ready for peak traffic?" | "What changed in the last hour?" | "Show me the riskiest open PR"
- On click: populate the input and submit

**User message:**
```
display: flex; gap: 10px; align-items: flex-start
```
- Avatar (left): 26px circle, `background: var(--s3); border: 0.5px solid var(--bd2)`. User initials, 9px, `--t3`
- Bubble: `background: var(--s2); border: 0.5px solid var(--bd); border-radius: 0 var(--r-lg) var(--r-lg) var(--r-lg); padding: 10px 14px; font-size: 12px; color: var(--t1); max-width: 480px; line-height: 1.6`

**Kubric response:**
```
display: flex; gap: 10px; align-items: flex-start; flex-direction: row-reverse
```
(Right-aligned, Kubric avatar on the right)

- Avatar (right): 26px circle, `background: var(--teal-dim); border: 0.5px solid var(--teal-bd)`. "K" in 9px mono, `--teal`
- Bubble: `background: var(--s2); border: 0.5px solid var(--bd); border-left: 2px solid var(--teal); border-radius: var(--r-lg) 0 var(--r-lg) var(--r-lg); padding: 10px 14px; font-size: 12px; color: var(--t2); max-width: 480px; line-height: 1.65`
- First line inside bubble: `color: var(--teal); font-family: var(--font-mono); font-size: 10px; display: block; margin-bottom: 6px` — e.g. "kubric · production-mumbai"
- Kubric can include action buttons inside the bubble for fixes. Use small `.fix-btn` variants.

**Typing indicator** (while Kubric is generating):
- Three animated dots. Each dot: `width: 6px; height: 6px; background: var(--teal); border-radius: 50%`
- Staggered opacity pulse animation (delays: 0ms, 200ms, 400ms)
- Shown in a Kubric bubble with the standard border

### Input Area

`border-top: 0.5px solid var(--bd); padding: 12px 24px; max-width: 680px; margin: 0 auto; width: 100%; display: flex; gap: 8px; align-items: center`

Input wrapper: `flex: 1; display: flex; gap: 8px; align-items: center; background: var(--s2); border: 0.5px solid var(--bd2); border-radius: var(--r-lg); padding: 8px 12px`

Text input: `flex: 1; background: transparent; border: none; outline: none; font-size: 12px; color: var(--t1)`. Placeholder: "Ask anything about your cluster — or say 'fix payment-service'"

Send button: `background: var(--teal-dim); border: 0.5px solid var(--teal-bd); color: var(--teal); border-radius: var(--r-md); padding: 5px 14px; font-size: 11px; cursor: pointer`

Send on Enter key. Shift+Enter for newline.

---

## 11. Screen 6 — Playbooks

**Route:** `/playbooks`  
**Sidebar active item:** Playbooks

### Purpose
Pre-built and custom runbooks. Kubric ships with 50 built-in playbooks for common K8s issues. Teams can add custom ones. When Kubric detects an issue, it automatically matches it to the best playbook.

### Layout
```
Screen selector bar
Page header: "Playbooks" | [+ New Playbook] button
Filter bar: Built-in | Custom | All categories dropdown
Two-column grid of playbook cards
```

### Playbook Card

`background: var(--s1); border: 0.5px solid var(--bd); border-radius: var(--r-xl); padding: 20px; cursor: pointer`

Hover: `border-color: var(--bd2); background: var(--s2)`

Content:
- Top row: category badge (e.g. "OOMKill", "CrashLoop") + "Built-in" or "Custom" label (right-aligned)
- Title: 13px 500, `--t1`, margin-top 10px
- Description: 11px, `--t2`, `line-height: 1.6`, 2 lines max
- Footer row: "Used N times" + "Last triggered: time ago" — both 10px, `--t3`

**Active playbook indicator:** If a playbook is currently executing, show a pulsing teal dot + "Running now" in `--teal`

---

## 12. Screen 7 — Settings

**Route:** `/settings`  
**Sidebar active item:** Settings

### Layout
```
Screen selector bar
Page header: "Settings"
Two-column: left nav (settings categories) | right content
```

### Settings Categories (left nav, 180px wide)

Vertical list of categories. Same `.nav-item` style but smaller (11px). Categories:
- Clusters
- Integrations
- Trust & Automation
- Notifications
- Team
- API Keys
- Billing

### Trust & Automation Settings (most important)

This is where users set the trust mode. Render as three radio-card options:

Each card: `background: var(--s1); border: 0.5px solid var(--bd); border-radius: var(--r-xl); padding: 20px; cursor: pointer; margin-bottom: 12px`

Selected card: `border-color: var(--teal-bd); background: var(--teal-dim)`

Card content:
- Radio circle (left) + Mode name (13px 500) + description (11px `--t2`)
- Mode names and descriptions:
  - **Suggest** — "Kubric shows you what to do. You do it. Zero automated actions."
  - **Approve** — "Kubric prepares the fix. You confirm with one click. Full control."
  - **Auto-fix** — "Kubric fixes defined issue categories automatically. Set the boundaries below."

Below the cards (only shown when Auto-fix is selected): a list of toggleable issue categories with individual switches (OOMKill, CrashLoopBackOff, ImagePullBackOff, Node pressure, Pending pods, etc.)

---

## 13. Interactions & Animations

### Transition Rules

| Interaction | Animation |
|-------------|-----------|
| Screen switch | `opacity: 0` → `opacity: 1`, 150ms ease |
| Incident selection (panel update) | Panel fades: `opacity: 0` → `opacity: 1`, 200ms ease |
| Workloads drawer open | `transform: translateX(100%)` → `translateX(0)`, 200ms ease |
| Workloads drawer close | Reverse of above |
| Accordion expand (incidents) | `max-height: 0` → `max-height: 600px`, 250ms ease |
| Hover on cards/rows | `background` color, 100ms |
| Pulse dot | Opacity 1→0.25→1, 2s ease-in-out, infinite |
| Command palette open | Backdrop `opacity: 0→1`, palette `translateY(-8px)→0`, 150ms ease |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `Escape` | Close palette / drawer / accordion |
| `↑` `↓` | Navigate command palette results |
| `Enter` | Select command palette result |
| `Enter` in chat input | Send message |
| `Shift+Enter` in chat | New line |

### Loading States

- **Cluster sync:** Refresh icon in topbar spins (`animation: spin 1s linear infinite`) while syncing
- **AI response generating:** Typing indicator (three dots) in chat
- **Fix applying:** Button shows spinner + "Applying..." text. Disable during application.
- **Initial data load:** Each content area shows skeleton loaders — gray animated shimmer blocks at the approximate size of the content they will replace

Skeleton shimmer:
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--r-md);
}
```

---

## 14. Responsive Behaviour

### Breakpoints

| Name | Width | Behaviour |
|------|-------|-----------|
| Desktop (default) | ≥ 1024px | Full two-column layout |
| Tablet | 768px–1023px | Sidebar collapses to icons only (48px). Right panel becomes a bottom sheet. |
| Mobile | < 768px | Sidebar hidden (hamburger menu). Single-column. Stat row becomes 2×2 grid. |

### Tablet (768–1023px)

- Sidebar: `width: 48px`. Nav items show only the icon, no label. Tooltip on hover shows the label.
- Main content: Single column. No right panel. Incident detail opens in a bottom sheet (slide up from bottom, `height: 60vh`).
- Screen selector bar: scrolls horizontally if needed.

### Mobile (< 768px)

- Sidebar: hidden. Hamburger icon (☰) in topbar opens a full-height slide-in nav drawer from the left.
- Stat row: `grid-template-columns: 1fr 1fr` (2×2).
- Two-column content layout collapses to single column.
- Detail panel becomes a full-screen overlay.
- Code blocks: horizontal scroll (`overflow-x: auto`).

---

## 15. Tech Stack & File Structure

### Recommended Stack

```
Framework:      Next.js 14+ (App Router)
Styling:        Tailwind CSS v3 (or plain CSS custom properties as defined above)
Icons:          Tabler Icons (outline only) — @tabler/icons-react
Fonts:          Inter (body) + JetBrains Mono (code) from Google Fonts
Charts:         Recharts (for sparklines only)
State:          Zustand (lightweight global state for selected incident, active screen)
API client:     SWR (data fetching + polling for live cluster data)
Animation:      Framer Motion (for drawer and panel transitions only)
```

### File Structure

```
/src
  /app
    layout.tsx              ← Shell grid, topbar, sidebar
    page.tsx                ← Redirects to /overview
    /overview/page.tsx
    /incidents/page.tsx
    /pr-risk/page.tsx
    /workloads/page.tsx
    /ask/page.tsx
    /playbooks/page.tsx
    /settings/page.tsx

  /components
    /layout
      Shell.tsx             ← CSS grid shell
      Topbar.tsx
      Sidebar.tsx
      ScreenSelector.tsx
      PageHeader.tsx

    /overview
      StatRow.tsx
      IncidentFeed.tsx
      IncidentItem.tsx
      DetailPanel.tsx
      ServiceHeader.tsx
      Sparkline.tsx
      RCABlock.tsx
      FixBlock.tsx
      PRRiskSummary.tsx

    /incidents
      IncidentAccordion.tsx
      IncidentTimeline.tsx
      FilterBar.tsx

    /pr-risk
      PRCard.tsx
      DiffBlock.tsx

    /workloads
      WorkloadTable.tsx
      WorkloadDrawer.tsx

    /ask
      ChatThread.tsx
      ChatMessage.tsx
      ChatInput.tsx
      TypingIndicator.tsx

    /playbooks
      PlaybookCard.tsx

    /settings
      TrustModeSelector.tsx
      IssueCategoryToggle.tsx

    /shared
      CommandPalette.tsx
      CodeBlock.tsx
      RiskBadge.tsx
      IncidentTag.tsx
      Button.tsx
      StatusDot.tsx
      SkeletonLoader.tsx
      ColHeader.tsx

  /hooks
    useClusterData.ts       ← SWR hook for cluster state, polls every 30s
    useIncidents.ts
    usePRRisks.ts
    useAskKubric.ts         ← Streaming chat API hook

  /stores
    uiStore.ts              ← Zustand: selectedIncident, activeScreen, commandPaletteOpen
    clusterStore.ts         ← Zustand: cluster selection

  /styles
    globals.css             ← CSS custom properties (all tokens from Section 3)
    animations.css          ← All @keyframes

  /lib
    api.ts                  ← API client (calls Kubric backend)
    formatters.ts           ← Time, memory, CPU formatting helpers
    constants.ts            ← Risk levels, status codes, tag types
```

### CSS Variables Setup

Put all tokens from Section 3 into `globals.css` under `:root`. Import in the root `layout.tsx`. This is the single source of truth — no hardcoded color hex values anywhere else in the codebase.

```css
/* globals.css */
:root {
  /* paste all variables from Section 3 here */
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--t1);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
```

---

## 16. Implementation Prompt

> Copy-paste this prompt directly into any AI IDE (Cursor, Windsurf, Claude Code) to start generating the UI.

---

```
Build the Kubric platform frontend from scratch using Next.js 14 (App Router), 
Tailwind CSS, and TypeScript. Follow the UI/UX specification in this file exactly.

START WITH THIS ORDER:

1. Set up globals.css with all CSS custom properties defined in Section 3.

2. Build the Shell layout (Section 4): CSS grid with topbar (40px) + sidebar 
   (200px) + main area. The shell does not scroll. Internal panels scroll 
   independently.

3. Build the Topbar component (Section 5.1) with the logo, cluster picker 
   pill, search bar, notification bell with badge, and avatar.

4. Build the Sidebar component (Section 5.2) with all nav items, section 
   labels, badges, and footer. Active state uses teal-dim background and 
   teal text.

5. Build the shared component library in /components/shared: Button, 
   RiskBadge, IncidentTag, StatusDot, CodeBlock, ColHeader, SkeletonLoader.

6. Build Screen 1 — Overview (Section 6): StatRow + two-column layout + 
   IncidentFeed (left) + DetailPanel (right). The DetailPanel shows the 
   selected incident's RCA, sparkline, YAML fix, and action buttons.

7. Build Screen 3 — PR Risk (Section 8): Full-width list of PRCard components. 
   Each card has a risk-colored border, diff block, risk explanation, and 
   action buttons.

8. Build Screen 5 — Ask Kubric (Section 10): Chat interface. User messages 
   on the left, Kubric responses on the right with a teal left-border. 
   Input at the bottom sends on Enter.

9. Build Screen 4 — Workloads (Section 9): Table with columns Service | 
   Pods | CPU | Memory | Status | Risk. Clicking a row opens a 340px 
   right drawer with service detail.

10. Wire up keyboard shortcut ⌘K to open the CommandPalette component.

DESIGN RULES (never violate these):
- Dark background only. var(--bg) = #07090C. No light mode.
- Service names and code always use var(--font-mono) (JetBrains Mono).
- No font-size below 10px.
- No font-weight above 500.
- Border width is always 0.5px (hairline). Never 1px decorative borders.
- Status dots that represent active critical incidents pulse (opacity animation).
- The "Apply fix" button is var(--teal) colored. The "Preview YAML" button 
  is ghost (transparent bg, var(--bd2) border).
- No Grafana-style time-series dashboards. No charts as primary content.
- Sparklines are supporting detail only — 32px tall, no axes.
- Every color in the codebase must reference a CSS variable. No hardcoded 
  hex values outside globals.css.

MOCK DATA:
Use static mock data from /lib/mockData.ts for all screens. Do not 
connect to a real API yet. The mock data should represent:
- 1 cluster: "production-mumbai", health score 74, last synced 12s ago
- 3 active incidents: payment-service (OOMKill, critical), order-api 
  (CrashLoopBackOff, critical), redis-cache (node pressure, warning)
- 7 resolved incidents today
- 2 open PRs with risk assessments (#247 HIGH, #251 MEDIUM)
- 5 workloads in the cluster
```

---

*Kubric UI/UX Specification v1.0 — built for India-first DevOps teams*  
*Last updated: 2026*
