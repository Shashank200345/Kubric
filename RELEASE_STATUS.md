# Kubric SaaS: Release Status

This document outlines the current state of the Kubric MVP, detailing exactly which features are hardened and ready for release, and what infrastructure or feature work remains before opening the platform to public beta users.

---

## ✅ Completed & Release-Ready Features

The core logic of the platform is fully engineered. The following features are considered "code complete" and production-ready:

### 1. The In-Cluster Kubernetes Agent
- **Native Kubernetes Client:** The agent utilizes the official `kubernetes` Python SDK (replacing brittle `kubectl` shell commands) to reliably communicate with the cluster's API server.
- **Accurate Crash Detection:** The logic inspects the *current* state of a container (`state.waiting.reason` / `state.terminated.reason`), eliminating false positives from historical crashes.
- **Push-Based Architecture:** The agent runs as a continuous loop, detecting failures instantly and POSTing the evidence to the backend, completely removing the need for the backend to insecurely poll external clusters.
- **Token-Optimized Payloads:** A robust serializer prunes K8s JSON bulk (like `managedFields`), substantially reducing LLM context window pressure and API costs.

### 2. The AI Ingestion Backend
- **Asynchronous Processing:** The `/api/v1/ingest` endpoint accepts payloads instantly (`202 Accepted`) and offloads the intensive LLM reasoning to FastAPI `BackgroundTasks`. This entirely eliminates network timeout errors.
- **AI Diagnostics:** The `KubernetesAIAgent` successfully analyzes Pods, Logs, Events, Deployments, and Networking evidence to generate Root Causes, Explanations, and actionable `kubectl` fixes.

### 3. Multi-Tenant Security & Database
- **Secure Token Mapping:** Agents authenticate via a unique `CLUSTER_TOKEN` that maps to a specific `user_id` inside the InsForge `clusters` table.
- **Tenant Isolation:** Row Level Security (RLS) is fully enforced on the database. Customers can only view incidents that belong to their specific `user_id`.

### 4. Enterprise Installation (Helm)
- **Helm Chart Packaged:** A complete Helm chart (`kubric-cli/charts/kubric-agent`) is configured.
- **Dynamic Overrides:** Enterprise engineers can inject their unique `clusterToken` and your public `ingestionEndpoint` at runtime without modifying source code.

---

## 🚧 Remaining Work (Pre-Launch Checklist)

While the *code* is complete, the following *infrastructure* and product steps must be completed before you can hand this to external engineers.

### 1. Cloud Deployment (Critical Blocker)
*Currently, the backend and frontend run on your local laptop.*
- **Backend:** Deploy the FastAPI server to a persistent cloud provider (e.g., Render, Railway, Fly.io, AWS ECS). This is mandatory so `BackgroundTasks` execute reliably without serverless timeout limits.
- **Frontend:** Deploy the React/Next.js dashboard to a static hosting provider (e.g., Vercel, Netlify, or InsForge Deployments).
- **Update Documentation:** Update the Helm installation instructions to point to your new public URL (`https://api.yourdomain.com/api/v1/ingest`) instead of `host.minikube.internal`.

### 2. User Onboarding Flow (High Priority)
*How do new users get their cluster token?*
- Currently, tokens are generated manually via SQL. 
- **Action Needed:** Add a "Add Cluster" button to your Frontend Dashboard that generates a new UUID in the `clusters` table and displays the `helm install` command with their token pre-filled.

### 3. Analytics & Telemetry (Recommended)
*How do you know if the agent is failing on their cluster?*
- Integrate error tracking (like Sentry) into the Python backend.
- (Optional) Implement PostHog or similar product analytics to track how often users view incidents on the dashboard.

### 4. Billing & Subscriptions (Optional for Beta)
*If you plan to charge for this immediately.*
- Implement Stripe / InsForge Payments.
- Update the `/api/v1/ingest` endpoint to reject payloads (`402 Payment Required`) if the user's subscription has expired or exceeded their tier's quota.
