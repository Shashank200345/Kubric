# Kubric — AI-Powered Kubernetes Troubleshooting Agent

Kubric is an autonomous SRE agent that diagnoses Kubernetes cluster failures, pinpoints root causes, and ships fixes — in seconds, not stand-ups. It scans your cluster, reasons over evidence with AI, and can auto-apply safe remediations with one click.

## What Kubric Does

- **Detects** — continuously watches for OOMKills, CrashLoops, ImagePullBackOff, Pending pods, failed rollouts
- **Diagnoses** — collects pods, logs, events, deployments, and networking state; reasons with GPT-4o-mini to produce a specific, evidence-cited root cause
- **Fixes** — proposes one of five safe, scoped Kubernetes actions (restart pod, rollback deployment, update resource limits, scale deployment, set env var) and executes it on approval
- **Explains** — provides symptoms, impact, affected resources, prevention advice, and a conversational drill-down for each incident

## Status & roadmap

Kubric is in active development. To set expectations honestly:

**Working today**
- Push-based in-cluster agent (Helm-installed), state ingestion, and the dashboard
- AI incident detection + diagnosis (one-shot, and an opt-in agentic ReAct reasoning loop)
- One-click remediation for five action types (see [Auto-Fix Safety](#auto-fix-safety))
- Onboarding wizard, per-shell install command, and a docs page (`/docs`)

**On the roadmap (not yet built)**
- **Pre-deploy PR risk** (GitHub App, diff analysis, PR comments) — surfaced in the UI as a preview labeled "Coming soon"
- **SOC 2** — designed for readiness; certification is planned, not yet obtained
- Auto-fix (autonomous) mode with policy guardrails and rollback-on-regression

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                     KUBRIC PLATFORM                                │
│                                                                   │
│  ┌────────────┐      ┌────────────────┐      ┌────────────────┐  │
│  │  Frontend  │─────▶│    Backend     │─────▶│   InsForge DB  │  │
│  │  (Next.js) │      │   (FastAPI)    │      │  (PostgreSQL)  │  │
│  └────────────┘      └────────────────┘      └────────────────┘  │
│                              ▲                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │ HTTPS (outbound only)
                    ┌──────────┴──────────┐
                    │    In-Cluster Agent  │
                    │  (runs inside your   │
                    │   Kubernetes cluster)│
                    └─────────────────────┘
```

**Key security principle:** the agent communicates outbound only. The backend never reaches into your cluster.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, GSAP |
| Backend | Python, FastAPI, OpenRouter (GPT-4o-mini) |
| Agent | Python, kubernetes-client, runs in-cluster |
| Database | PostgreSQL via InsForge (BaaS) |
| Auth | InsForge Auth (email + OAuth) |
| Realtime | InsForge Realtime (WebSocket pub/sub) |
| CLI | Go (kubric-cli) |

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+ and pip
- minikube or kind (local Kubernetes cluster)
- kubectl configured (`kubectl get nodes` works)
- An [InsForge](https://insforge.dev) project (free tier works)
- An [OpenRouter](https://openrouter.ai) API key

### 1. Clone the repo

```bash
git clone https://github.com/Shashank200345/Kubric.git
cd Kubric
```

### 2. Start your local cluster

```bash
minikube start
# or: kind create cluster

# Verify:
kubectl get nodes
```

### 3. Set up the backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:
```env
INSFORGE_URL=https://your-project.region.insforge.app
INSFORGE_API_KEY=your-insforge-service-key
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=openai/gpt-4o-mini
KUBRIC_DATA_SOURCE=local
CORS_ORIGINS=http://localhost:3000
```

Start the backend:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: `http://localhost:8000/health` → `{"status": "healthy"}`

### 4. Set up the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_INSFORGE_URL=https://your-project.region.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your-insforge-anon-key
```

Start the frontend:
```bash
npm run dev
```

Open: `http://localhost:3000`

### 5. Sign up and explore

1. Go to `http://localhost:3000/login`
2. Create an account (email + password)
3. You'll land on the dashboard showing live cluster state

### 6. Test the auto-fix flow

Deploy a broken workload:
```bash
kubectl apply -f kubric-cli/test-manifests/1-oom-autofix.yaml
```

Wait ~15s for the pod to crash, then:
1. Go to **Troubleshoot** → select your cluster → **Scan Cluster**
2. Watch the AI diagnose the OOMKill (90%+ confidence)
3. Click **Approve & Run Fix** → memory limit gets raised
4. Pod recovers within 30s

Clean up:
```bash
kubectl delete ns kubric-fix-tests
```

## Test Scenarios

Each scenario tests one of the five auto-fixable actions:

| Manifest | Issue | Expected Action |
|---|---|---|
| `1-oom-autofix.yaml` | OOMKilled (50Mi limit, 150Mi usage) | `update_resource_limits` |
| `2-missing-env-autofix.yaml` | Missing required env var | `update_environment_variable` |
| `3-rollback-autofix.yaml` | Bad image after rollout | `rollback_deployment` |
| `4-restart-pod-autofix.yaml` | Transient crash | `restart_pod` |
| `5-scale-autofix.yaml` | Over-provisioned (Pending pods) | `scale_deployment` |

All manifests are in `kubric-cli/test-manifests/`. Apply one at a time, scan, approve, verify, then delete.

For scenario 3, apply first then break it:
```bash
kubectl apply -f kubric-cli/test-manifests/3-rollback-autofix.yaml
# Wait for pod to be Running, then:
kubectl -n kubric-fix-tests set image deployment/rollback-autofix app=nginx:this-tag-does-not-exist-9999
```

## Project Structure

```
.
├── frontend/          # Next.js dashboard + landing page
├── backend/           # FastAPI backend (AI reasoning, API)
│   └── app/
│       ├── ai/        # LLM agent, prompts, guardrails
│       ├── kubernetes/ # Inspectors, executor, service
│       └── main.py    # All API endpoints
├── agent/             # In-cluster Python agent
│   ├── main.py        # Poll loop (detect, push, execute)
│   └── collector.py   # Cluster state snapshot builder
├── kubric-cli/        # Go CLI + Helm chart
│   ├── charts/        # Helm chart for agent deployment
│   └── test-manifests/ # Auto-fix test scenarios
├── docs/              # Architecture notes, deployment guide
└── migrations/        # Database schema (InsForge SQL)
```

## Push vs Pull Architecture

Kubric supports two data modes controlled by `KUBRIC_DATA_SOURCE`:

- **`local`** (default, for development): the backend runs `kubectl` directly against your kubeconfig. Fast, zero setup.
- **`agent`** (production): the in-cluster agent pushes cluster state to the backend every 15s. The backend never touches the cluster directly. Secure, multi-tenant, no inbound firewall holes.

See `docs/ARCHITECTURE_push-vs-pull.md` for the full security rationale.

## Reasoning Modes

The diagnosis engine has two modes, controlled by `KUBRIC_REASONING_MODE`:

- **`oneshot`** (default): a single LLM call reasons over a fixed evidence bundle and returns a diagnosis. Fast and predictable.
- **`react`**: an agentic, **read-only** ReAct loop. The model calls read-only tools (`list_pods`, `describe_pod`, `get_pod_logs`, `list_events`, `list_deployments`, `list_nodes`) to gather exactly the evidence it needs and follow the cause across resources (multi-hop root cause). It's bounded (iteration + tool-call budget + timeout), runs tool calls concurrently, caches results, and always falls back to `oneshot` on any failure. It never mutates the cluster — remediation still requires approval. Both backends (`local` kubectl and `agent` snapshot) are supported.

## Running the Agent (Push Mode)

To test the push architecture locally:

1. Generate a cluster token: Dashboard → Settings → Clusters → Generate Token
2. Run the agent:
```bash
cd agent
pip install -r requirements.txt
export CLUSTER_TOKEN=<generated-token>
export INGESTION_ENDPOINT=http://localhost:8000/api/v1/ingest
export CLUSTER_NAME=minikube
python main.py
```
3. Set `KUBRIC_DATA_SOURCE=agent` in `backend/.env` and restart the backend
4. The dashboard now reads from pushed snapshots

### Installing the agent in a real cluster (Helm, no clone)

The Helm chart is served by the backend, so end users don't need to clone the repo:

```bash
helm install kubric-agent https://<your-backend>/install/kubric-agent-0.1.0.tgz \
  -n kubric-system --create-namespace \
  --set agent.token=<token-from-dashboard> \
  --set agent.clusterName=<cluster-name> \
  --set agent.ingestionEndpoint=https://<your-backend>/api/v1/ingest
```

The onboarding wizard and **Settings → Clusters** generate this command pre-filled and formatted for your shell (macOS/Linux, PowerShell, or Windows CMD). The agent image must be pullable by the cluster (public registry), and `metrics-server` is recommended for CPU/memory metrics.

## Production Deployment

See `docs/DEPLOYMENT_GUIDE.md` for the full guide. Summary:

| Component | Where | How |
|---|---|---|
| Frontend | Vercel | Connect repo, root dir = `frontend` |
| Backend | Railway / Render | Connect repo, root dir = `backend` |
| Agent | Inside each customer cluster | Helm install |

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `INSFORGE_URL` | Your InsForge project URL |
| `INSFORGE_API_KEY` | InsForge service/admin key (server-side only) |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI reasoning |
| `OPENROUTER_MODEL` | LLM model (default: `openai/gpt-4o-mini`) |
| `KUBRIC_DATA_SOURCE` | `local` (dev, uses kubectl) or `agent` (production, uses pushed snapshots) |
| `KUBRIC_REASONING_MODE` | `oneshot` (default, single-shot analysis) or `react` (agentic read-only tool loop) |
| `BACKEND_PUBLIC_URL` | Public backend URL, used to build the agent install command |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (no trailing slash) |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge public/anon key |

### Agent (environment variables or Helm values)

| Variable | Description |
|---|---|
| `INGESTION_ENDPOINT` | Backend ingest URL |
| `CLUSTER_TOKEN` | Per-cluster auth token |
| `CLUSTER_NAME` | Human-readable cluster name |
| `POLL_INTERVAL_SECONDS` | Polling interval (default: 15) |

## Auto-Fix Safety

The agent never applies a fix without explicit user approval. The safety chain:

1. **AI proposes** an action from exactly 5 allowed types
2. **Deterministic backstop** validates the action matches the root cause category
3. **LLM plausibility check** confirms the action makes sense
4. **User approval** — the fix button is shown only when all checks pass
5. **Execution** — runs with the agent's scoped in-cluster RBAC (not a super-admin)
6. **Result reporting** — real kubectl output shown to the user (success or failure)

Blocked namespaces (`kube-system`, `kube-public`, `kube-node-lease`) can never be modified.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm run build` in `frontend/` to verify
5. Submit a PR

Never commit `.env`, `.env.local`, or API keys. The `.gitignore` is configured to prevent this.

## License

MIT

## Links

- [Live Demo](https://kubric.vercel.app)
- [Documentation](./docs/)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- [Architecture](./docs/ARCHITECTURE_push-vs-pull.md)
