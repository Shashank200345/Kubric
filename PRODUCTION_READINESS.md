# Kubric Agent: Production Readiness & Architecture Optimizations

This document details the architectural evolution of the Kubric Kubernetes Agent and the specific engineering optimizations implemented to transition it from a local proof-of-concept to a secure, enterprise-ready, multi-tenant SaaS.

---

## 1. Architectural Shift: Pull to Push Model

**The Problem:** 
Originally, the backend attempted to execute `kubectl` commands synchronously during an HTTP request. This "Pull" architecture caused severe latency and resulted in FastAPI/Vercel timeout limits (e.g., 30s timeouts) because the LLM reasoning took too long.

**The Solution:**
We transitioned to a **Push-based In-Cluster Agent Architecture**:
- A lightweight Python agent runs continuously inside the customer's Kubernetes cluster as a Deployment.
- The agent actively monitors the cluster for failures (CrashLoopBackOff, OOMKilled).
- When a failure is detected, the agent gathers evidence locally and asynchronously POSTs it to the backend's `/api/v1/ingest` endpoint.
- The backend immediately returns a `202 Accepted` and offloads the heavy AI reasoning to a non-blocking `BackgroundTask`.
- **Result:** Zero HTTP timeouts, decoupled workloads, and a highly scalable backend.

---

## 2. Payload Pruning & Bandwidth Optimization

**The Problem:**
Kubernetes JSON manifests (like Pods and Deployments) are notoriously bloated. Fields like `managedFields` and `kubectl.kubernetes.io/last-applied-configuration` can easily consume tens of thousands of tokens, which bloated network requests, degraded AI context windows, and inflated LLM API costs.

**The Solution:**
- Implemented a rigorous `serialize_and_prune` utility in `agent/k8s/client.py`.
- Strips out all verbose annotations and `managedFields` before the payload is ever sent over the network.
- **Result:** Substantial reduction in payload size (typically eliminating the majority of raw manifest bulk), lowering LLM API costs and improving network transmission speed.

---

## 3. Migration to Native Kubernetes Client

**The Problem:**
The original prototype relied on hacky Python subprocesses executing shell commands (`subprocess.Popen(["kubectl", "get", "pods", "-o", "json"])`). This was brittle, prone to shell injection, difficult to handle errors gracefully, and required a bulky Docker image containing the `kubectl` binary.

**The Solution:**
- Completely refactored all 5 inspectors (Pods, Logs, Events, Deployments, Networking) to use the official, native **Kubernetes Python API SDK** (`kubernetes.client.CoreV1Api`).
- **Result:** 
  - Type-safe, structured Python objects instead of parsing raw JSON strings.
  - Robust exception handling and connection pooling.
  - Much lighter and more secure agent Docker footprint.

---

## 4. Smarter Crash Detection Logic

**The Problem:**
The old polling logic contained a notorious "history bug." It unconditionally checked a pod's `restart_count` or `lastState`. If a pod crashed yesterday but successfully recovered to a healthy `Running` state today, the backend would erroneously trigger an incident.

**The Solution:**
- Re-wrote the detection engine to strictly evaluate the **current** container state (`cs.state.waiting.reason` and `cs.state.terminated.reason`).
- Only if the pod is *actively* failing does the agent check the historical `last_state` to determine if the root cause was an `OOMKilled` or a generic crash.
- **Result:** Zero false positives. Only actionable, currently failing workloads are sent to the AI.

---

## 5. Security, Multi-Tenancy & Auth

**The Problem:**
The MVP backend endpoint accepted payloads blindly without mapping them to a specific organization. If Engineer A and Engineer B both installed the agent, their incidents would mingle in the same database table, breaking data isolation.

**The Solution:**
- **Database Schema:** Created a secure `clusters` table mapping a unique `CLUSTER_TOKEN` (UUID) to a specific SaaS `user_id`.
- **Enforced Row Level Security (RLS):** Supabase RLS policies guarantee users can only query incidents linked to their authenticated `user_id`.
- **Endpoint Validation:** The `/api/v1/ingest` endpoint strictly requires a `Bearer <CLUSTER_TOKEN>` header. It validates this against the database before ever executing the AI, ensuring incidents are safely scoped to the correct tenant.
- **Result:** A robust security foundation designed with future SOC 2 readiness in mind.

---

## 6. Enterprise-Ready Helm Configuration

**The Problem:**
Local development environments use `localhost` or `host.docker.internal`, which silently fail when deployed to real production clusters (AWS EKS, Azure AKS, Google GKE).

**The Solution:**
- Hardened local development defaults by utilizing `host.minikube.internal` for cross-platform local reliability.
- Packaged the agent into a professional **Helm Chart** (`kubric-cli/charts/kubric-agent`).
- Exposed `ingestionEndpoint` and `clusterToken` in `values.yaml`.
- This allows enterprise engineers to dynamically inject your production cloud URL (`https://api.kubric.com/api/v1/ingest`) and their secure token into the agent's environment variables at installation time, seamlessly overriding local defaults.
- **Result:** One-line installation for enterprise engineers, fully decoupled from local development constraints.
