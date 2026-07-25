# Kubric — Production Deployment Guide


A complete guide for deploying the Kubric platform (frontend, backend, and in-cluster agent) for production use and open-source contributors.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KUBRIC CLOUD (your infra)                    │
│                                                                     │
│  ┌──────────────┐       ┌──────────────────┐       ┌────────────┐  │
│  │   Frontend   │──────▶│     Backend      │──────▶│  InsForge   │  │
│  │  (Next.js)   │       │   (FastAPI)      │       │  (BaaS DB)  │  │
│  └──────────────┘       └──────────────────┘       └────────────┘  │
│        ▲                        ▲                                   │
└────────┼────────────────────────┼───────────────────────────────────┘
         │ HTTPS                  │ HTTPS (outbound only)
         │                        │
┌────────┼────────────────────────┼───────────────────────────────────┐
│        │     CUSTOMER CLUSTER   │                                   │
│        │                  ┌─────┴──────┐                            │
│        │                  │   Kubric   │                            │
│        │                  │   Agent    │                            │
│        │                  │ (in-cluster)│                            │
│        │                  └────────────┘                            │
│        │                                                            │
│   Users access the dashboard via browser                            │
└─────────────────────────────────────────────────────────────────────┘
```

Key principle: **the agent communicates outbound only**. The backend never reaches into the customer's cluster. All data flows from agent → backend over HTTPS.

---

## 1. Frontend (Next.js)

### What it is
A Next.js 16 app with React 19, Tailwind CSS 4, and GSAP animations. It renders the landing page, auth flow, and the full dashboard SPA.

### Where to deploy
Any static/edge-capable host that supports Next.js:
- **Recommended:** Vercel, Cloudflare Pages, or AWS Amplify (zero-config Next.js support)
- **Self-hosted:** Any Docker host or Kubernetes cluster running `next start`

### Environment variables

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (no trailing slash) | `https://api.kubric.dev` |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL | `https://45syfrke.us-east.insforge.app` |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge anonymous/public key | `eyJ...` |

### Build & deploy steps

```bash
cd frontend

# 1. Install dependencies
npm ci

# 2. Create .env.local (or set env vars in your hosting provider)
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=https://api.kubric.dev
NEXT_PUBLIC_INSFORGE_URL=https://45syfrke.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your-anon-key
EOF

# 3. Build
npm run build

# 4a. Deploy to Vercel (recommended)
npx vercel --prod

# 4b. OR run as a Docker container
docker build -t kubric-frontend .
docker run -p 3000:3000 kubric-frontend

# 4c. OR self-host with Node
npm start
```

### Docker (Dockerfile already exists at `frontend/Dockerfile`)
The image exposes port 3000. Pass environment variables at runtime.

---

## 2. Backend (FastAPI / Python)

### What it is
A Python FastAPI service that:
- Serves dashboard read APIs (clusters, pods, nodes, workloads, metrics, events)
- Runs AI diagnosis via OpenRouter (GPT-4o-mini)
- Receives agent push data (`/api/v1/state`, `/api/v1/ingest`)
- Dispatches and tracks remediation actions
- Manages CLI auth flows

### Where to deploy
Any container-capable platform:
- **Recommended:** Railway, Render, Fly.io, or AWS ECS/Fargate
- **Self-hosted:** Any Docker host or Kubernetes Deployment
- **For local dev:** runs directly with `uvicorn`

### Environment variables

| Variable | Description | Example |
|---|---|---|
| `INSFORGE_URL` | InsForge project URL (same as frontend) | `https://45syfrke.us-east.insforge.app` |
| `INSFORGE_API_KEY` | InsForge **service/admin** API key (bypasses RLS) | `eyJ...` |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI reasoning | `sk-or-...` |
| `OPENROUTER_MODEL` | LLM model identifier | `openai/gpt-4o-mini` |
| `KUBRIC_DATA_SOURCE` | `local` (dev, uses kubectl) or `agent` (production, uses pushed snapshots) | `agent` |

### Build & deploy steps

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Create .env
cat > .env <<EOF
INSFORGE_URL=https://45syfrke.us-east.insforge.app
INSFORGE_API_KEY=your-service-key
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=openai/gpt-4o-mini
KUBRIC_DATA_SOURCE=agent
EOF

# 3a. Run locally (development)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3b. Run as Docker container (production)
docker build -t kubric-backend .
docker run -p 8000:8000 --env-file .env kubric-backend

# 3c. Deploy to Railway/Render/Fly
# Just connect the repo, set env vars in the dashboard, and point the
# start command to: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Important notes
- In production (`KUBRIC_DATA_SOURCE=agent`), the backend does NOT need `kubectl` or any kubeconfig. It reads data pushed by agents and runs AI reasoning only.
- In local dev (`KUBRIC_DATA_SOURCE=local`), the backend shells out to `kubectl` against your local kubeconfig (minikube/kind). This is the default.
- CORS is currently `allow_origins=["*"]`. Lock this to your frontend domain in production.

---

## 3. In-Cluster Agent (Python)

### What it is
A lightweight Python process that runs inside each customer's Kubernetes cluster. It:
1. **Collects** cluster state (pods, nodes, workloads, events, metrics, logs) every 15s
2. **Pushes** the snapshot to the backend's `POST /api/v1/state`
3. **Detects** incidents (OOM, CrashLoop, ImagePull) and pushes evidence to `POST /api/v1/ingest`
4. **Polls** `GET /api/v1/actions/pending` for approved fixes
5. **Executes** remediation actions (restart, rollback, scale, resource update, env var) with in-cluster RBAC
6. **Reports** execution results back to `POST /api/v1/actions/{id}/result`

### Where to deploy
Always inside the **customer's** Kubernetes cluster, deployed via Helm.

### Environment variables (set via Helm values)

| Variable | Description | Example |
|---|---|---|
| `INGESTION_ENDPOINT` | Backend ingest URL | `https://api.kubric.dev/api/v1/ingest` |
| `CLUSTER_TOKEN` | Per-cluster auth token (generated in Settings) | `abc123...` |
| `CLUSTER_NAME` | Human-readable cluster identifier | `production-us-east` |
| `POLL_INTERVAL_SECONDS` | Polling interval in seconds | `15` |

### Deploy steps (end-user flow)

```bash
# 1. In the Kubric dashboard: Settings → Clusters → Add cluster
#    Enter a name → "Generate Token" → copy the Helm command shown.

# 2. Run the Helm install in the target cluster:
helm install kubric-agent ./kubric-cli/charts/kubric-agent \
  -n kubric-system --create-namespace \
  --set agent.clusterToken=<generated-token> \
  --set agent.clusterName=production-us-east \
  --set agent.ingestionEndpoint=https://api.kubric.dev/api/v1/ingest

# 3. Verify the agent is running:
kubectl -n kubric-system get pods
kubectl -n kubric-system logs -l app=kubric-agent --tail=20

# 4. Within ~30s, the dashboard will show the cluster's data.
```

### RBAC requirements
The Helm chart creates a `ClusterRole` with:
- `get`, `list`, `watch` on pods, nodes, deployments, events, replicasets, services
- `delete` on pods (for restart_pod action)
- `patch` on deployments (for rollback, scale, resource limits, env vars)
- `get` on pod logs

This is the minimum required for full scan + remediation functionality.

### Building the agent Docker image

```bash
cd agent
docker build -t kubric-agent:latest .
# Push to your container registry:
docker tag kubric-agent:latest your-registry.io/kubric-agent:v0.1.0
docker push your-registry.io/kubric-agent:v0.1.0
```

Update `kubric-cli/charts/kubric-agent/values.yaml` with your registry path.

---

## 4. Database (InsForge / PostgreSQL)

### What it is
InsForge provides the PostgreSQL database with PostgREST API, authentication (email + OAuth), Row-Level Security, realtime pub/sub, and file storage.

### Tables used
- `investigations` — scan results and AI diagnoses
- `investigation_progress` — per-step progress updates (realtime)
- `clusters` — registered clusters with auth tokens
- `actions` — queued/executed remediation actions
- `cluster_state` — latest agent-pushed snapshots (pods, nodes, workloads, events, metrics, logs)

### Migrations
Apply in order from `frontend/migrations/` and the root `migrations/` folder:
```
migrations/20260604083138_create-investigations.sql
frontend/migrations/20260606083511_create-investigation-progress.sql
frontend/migrations/20260710224100_add_evidence_used.sql
frontend/migrations/20260711200000_create_actions_table.sql
frontend/migrations/20260711_create_commands_table.sql
frontend/migrations/20260721_create_cluster_state.sql
```

Run via InsForge CLI or the SQL editor in the InsForge dashboard.

### Keys
- **Anon key** (public, used by the frontend SDK): safe to expose, scoped by RLS.
- **Service/admin key** (private, used by the backend): bypasses RLS. Never expose to the client.

---

## 5. External Services

| Service | Purpose | Required? |
|---|---|---|
| **OpenRouter** | AI reasoning (GPT-4o-mini or any supported model) | Yes |
| **InsForge** | Database, auth, realtime, storage | Yes (or self-host Postgres + PostgREST) |
| **GitHub** (future) | PR risk scanning via GitHub App | No (placeholder UI exists) |

---

## 6. Local Development (Quick Start)

```bash
# Prerequisites: Node 20+, Python 3.11+, minikube or kind running

# Terminal 1: Backend
cd backend
pip install -r requirements.txt
# Create .env with INSFORGE_URL, INSFORGE_API_KEY, OPENROUTER_API_KEY
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
# Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev

# Terminal 3: (Optional) Agent for testing push mode
cd agent
pip install -r requirements.txt
export CLUSTER_TOKEN=your-test-token
export INGESTION_ENDPOINT=http://localhost:8000/api/v1/ingest
python main.py

# The dashboard is at http://localhost:3000
# Backend API is at http://localhost:8000
# Default data source is 'local' (backend uses your kubeconfig directly)
```

---

## 7. Production Checklist

- [ ] Frontend deployed with correct `NEXT_PUBLIC_*` env vars
- [ ] Backend deployed with `KUBRIC_DATA_SOURCE=agent` and all secrets set
- [ ] CORS locked to frontend domain only (not `*`)
- [ ] All DB migrations applied
- [ ] Agent Docker image built and pushed to a registry
- [ ] Helm chart `values.yaml` updated with the correct image and backend URL
- [ ] At least one cluster connected via Settings → Generate Token → Helm install
- [ ] OpenRouter API key has sufficient credits
- [ ] HTTPS/TLS on both frontend and backend URLs
- [ ] InsForge RLS policies verified (users can only see their own data)

---

## 8. Open-Source Contribution Notes

- **Never commit secrets.** `.env`, `.env.local`, and `.insforge/project.json` are in `.gitignore`.
- The repo uses two remotes: `origin` (the original agent repo) and `kubric` (the product repo at `github.com/Shashank200345/Kubric`).
- Backend tests are in `backend/test_*.py` (manual scripts, not a formal test suite yet).
- The `v2_backups/` and `pre_restore_backup/` folders are recovery artifacts — do not delete but also do not ship in releases.
- The architecture doc at `docs/ARCHITECTURE_push-vs-pull.md` explains the security model and data flow.
