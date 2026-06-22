# AI Kubernetes Troubleshooting Agent

If you've spent any time managing Kubernetes, you know the drill. A deployment goes sideways, and suddenly you're staring at a sea of `CrashLoopBackOff` or `ImagePullBackOff` statuses. 

What follows is the tedious, repetitive dance we all do:
1. `kubectl get pods -n <namespace>`
2. `kubectl describe pod <pod-name>`
3. `kubectl logs <pod-name> --previous` (because it crashed before you could catch it)
4. `kubectl get events --sort-by='.metadata.creationTimestamp'`
5. Staring at the output, googling the specific error string, and hoping it's just a typo in a config map.

When things break, the cluster usually tells you exactly what's wrong—it's just buried under layers of JSON, events, and log streams. I built this agent to automate that exact manual discovery process.

## What is this?

This project is an AI-driven troubleshooting agent that acts like a junior DevOps engineer looking over your shoulder. Instead of manually running a dozen `kubectl` commands to gather context, you click a button. 

The agent automatically:
- Scans your cluster for unhealthy pods, failing deployments, and networking issues.
- Pulls the recent logs (handling edge cases like fetching `--previous` logs if a container died instantly).
- Aggregates recent warning events.
- Feeds this structured context to an LLM to diagnose the root cause.
- Hands you back a human-readable explanation, the exact root cause, and the `kubectl` command to fix it.

## Architecture & How it Works

I wanted to keep the architecture clean, with a clear separation between the frontend UI, the backend investigation logic, and the state management.

- **Frontend (Next.js / React / Tailwind):** Provides a clean, dark-mode dashboard. When an investigation kicks off, it polls the backend to show you a step-by-step live animation of what the agent is currently doing (Checking Pods -> Reading Logs -> Analyzing Events -> AI Reasoning).
- **Backend (Python / FastAPI):** The heavy lifter. It uses a custom `KubectlExecutor` to safely run read-only commands against your local kubeconfig. It has dedicated "Inspectors" (Pods, Logs, Events, Network) that gather evidence. 
- **State & Database (InsForge):** Used as the backend-as-a-service. It handles user auth and stores the history of investigations. As the Python backend runs through its checks, it pushes state updates to an InsForge Postgres database, which the frontend reads to update the UI in real-time.
- **AI Brain (OpenRouter / GPT-4o-mini):** Once the backend gathers all the evidence, it structures it into a prompt and asks the LLM to figure out what went wrong.

## Running it Locally

### Prerequisites
- Docker & Docker Compose
- `kubectl` installed locally and pointing to a valid cluster (like `kind`, `minikube`, or a remote cluster).
- An OpenRouter API key.
- An InsForge instance URL and API keys.

### Setup

1. Copy the `.env` templates to actual `.env` files in `backend/` and `frontend/`.
2. Spin up the stack:
   ```bash
   docker-compose up --build
   ```
3. Open `http://localhost:3000` in your browser.
4. Log in, select your cluster context, and hit **Investigate Cluster**.

## Why take this approach?

LLMs are great at debugging, but they are completely useless if you don't give them the right context. Trying to copy-paste terminal outputs into ChatGPT is annoying and prone to missing crucial details. By building a tool that programmatically scrapes the exact state of the cluster and feeds it directly to the model, the accuracy of the diagnoses skyrockets. It stops being a chatbot and starts being an actual utility. 
