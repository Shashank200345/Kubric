# Building the Placeholder Kubric Agent Chart — Unblock CLI Testing

> Purpose: `kubric connect` needs *something* to `helm install` against
> before the real in-cluster agent exists. This chart is a deliberate
> placeholder — a namespace and a bare-bones Deployment that does
> nothing except prove the install path works end to end. It is not
> the real agent. It gets replaced later without any changes to
> `connect.go` on the CLI side.

---

## Table of Contents

1. [Why This Exists](#1-why-this-exists)
2. [Master Prompt — Build Everything In One Shot](#2-master-prompt--build-everything-in-one-shot)
3. [Step-by-Step Breakdown](#3-step-by-step-breakdown)
4. [Wiring It Into `kubric connect`](#4-wiring-it-into-kubric-connect)
5. [Testing Checklist](#5-testing-checklist)
6. [How This Gets Replaced Later](#6-how-this-gets-replaced-later)

---

## 1. Why This Exists

`connect.go` already shells out to:
```bash
helm upgrade --install kubric-agent kubric/kubric-agent --values <file>
```
That fails right now for two independent reasons: Helm might not be installed locally (a five-minute fix on the test machine), and `kubric/kubric-agent` doesn't exist as a published chart anywhere, because the real agent hasn't been built yet.

Publishing a real Helm chart repository is real infrastructure — hosting, versioning, a release process — that isn't needed yet for testing with a handful of early reviewers. Instead, this chart lives as a local folder inside the CLI's own repo and gets installed by local path instead of by repo name. That's enough to test the entire `connect` flow — cluster picking, live Helm output, the final status print — without the real agent existing yet.

---

## 2. Master Prompt — Build Everything In One Shot

Paste this single prompt into your AI coding tool to generate the whole chart at once. The detailed breakdown in Section 3 exists if you'd rather review or adjust each file individually first.

```
Create a minimal Helm chart named "kubric-agent" at ./charts/kubric-agent
in my repo. This is a deliberate placeholder standing in for a real
in-cluster agent that hasn't been built yet — it should do nothing
except prove that a Helm install/upgrade succeeds and that a pod comes
up healthy, so a CLI's `helm upgrade --install` call has something real
to install against during testing.

Chart.yaml:
  - apiVersion: v2, name: kubric-agent, type: application
  - version: 0.1.0, appVersion: "0.1.0"
  - description: "Placeholder Kubric in-cluster agent — not the real agent yet"

values.yaml with these fields, matching what the CLI already sends as
Helm values (clusterToken, ingestionEndpoint, image tag/repo):
  image:
    repository: busybox
    tag: "1.36"
  ingestionEndpoint: "https://api.kubric.dev/v1/ingest"
  clusterToken: ""
  clusterName: ""
  resources:
    requests: { cpu: "10m", memory: "16Mi" }
    limits:   { cpu: "50m", memory: "32Mi" }

templates/namespace.yaml:
  - creates a Namespace called "kubric-system" if it doesn't already
    exist (use a helm hook or just a plain Namespace resource — plain
    is fine for this placeholder)

templates/secret.yaml:
  - a Secret in the kubric-system namespace holding clusterToken from
    values, named "kubric-agent-credentials", so the real agent later
    can read it the same way this placeholder demonstrates the pattern

templates/deployment.yaml:
  - a Deployment named "kubric-agent" in namespace kubric-system
  - 1 replica
  - uses the busybox image from values, with resources from values
  - command that just loops forever printing a heartbeat line every
    30 seconds, e.g.:
      command: ["/bin/sh", "-c"]
      args: ["while true; do echo '[kubric-agent placeholder] heartbeat — clusterName='$CLUSTER_NAME; sleep 30; done"]
  - sets CLUSTER_NAME as an env var from values.clusterName
  - sets INGESTION_ENDPOINT as an env var from values.ingestionEndpoint
  - mounts the clusterToken secret as an env var CLUSTER_TOKEN
    (valueFrom.secretKeyRef, not a plain value, so the pattern matches
    how a real secret-holding agent should be wired)
  - a basic livenessProbe using `exec` that just checks the process is
    running (e.g. `pgrep sh` or similar simple check), so `helm install`
    reports the pod as genuinely healthy, not just "created"

templates/_helpers.tpl:
  - standard Helm chart name/fullname/labels helpers, nothing unusual

Add a top-level README.md in the chart folder with one paragraph
stating clearly: "This is a placeholder chart. It does not run real
diagnostics or collect real cluster data. It exists to let `kubric
connect` be tested end-to-end before the real in-cluster agent is
built. Replace templates/deployment.yaml's image and command when the
real agent is ready — the values.yaml contract (clusterToken,
ingestionEndpoint, clusterName, image) should stay the same so the CLI
never needs to change."

After generating all files, run `helm lint ./charts/kubric-agent` and
fix any lint errors before finishing.
```

---

## 3. Step-by-Step Breakdown

If you'd rather build this incrementally instead of using the master prompt above, here's the same work split into pieces.

### Step 3.1 — Chart scaffold

```bash
helm create charts/kubric-agent
```
This generates a full default chart with far more than you need (ingress, service account templates, HPA, etc.). Delete everything except `Chart.yaml`, `values.yaml`, `templates/_helpers.tpl`, and `templates/deployment.yaml` — the rest is boilerplate for a real application chart, not this placeholder.

### Step 3.2 — `Chart.yaml`

```yaml
apiVersion: v2
name: kubric-agent
description: "Placeholder Kubric in-cluster agent — not the real agent yet"
type: application
version: 0.1.0
appVersion: "0.1.0"
```

### Step 3.3 — `values.yaml`

```yaml
image:
  repository: busybox
  tag: "1.36"

ingestionEndpoint: "https://api.kubric.dev/v1/ingest"
clusterToken: ""
clusterName: ""

resources:
  requests:
    cpu: "10m"
    memory: "16Mi"
  limits:
    cpu: "50m"
    memory: "32Mi"
```

**Why these exact field names matter:** this is the contract between the CLI and the chart. `connect.go` builds a Helm values file from what the backend's `ConnectCluster` call returns, and this chart has to accept fields under those same names. Keep `clusterToken`, `ingestionEndpoint`, `clusterName`, and `image` stable — when the real agent replaces this placeholder, the CLI shouldn't need to change at all if this contract stays the same.

### Step 3.4 — `templates/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kubric-system
```

### Step 3.5 — `templates/secret.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kubric-agent-credentials
  namespace: kubric-system
type: Opaque
stringData:
  clusterToken: {{ .Values.clusterToken | quote }}
```

This exists mainly to establish the pattern — the real agent will need its per-cluster token delivered exactly this way (as a mounted secret, not a plain environment value), so the placeholder demonstrates the wiring even though nothing sensitive depends on it yet.

### Step 3.6 — `templates/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubric-agent
  namespace: kubric-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubric-agent
  template:
    metadata:
      labels:
        app: kubric-agent
    spec:
      containers:
        - name: kubric-agent
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          command: ["/bin/sh", "-c"]
          args:
            - |
              while true; do
                echo "[kubric-agent placeholder] heartbeat — cluster=$CLUSTER_NAME"
                sleep 30
              done
          env:
            - name: CLUSTER_NAME
              value: "{{ .Values.clusterName }}"
            - name: INGESTION_ENDPOINT
              value: "{{ .Values.ingestionEndpoint }}"
            - name: CLUSTER_TOKEN
              valueFrom:
                secretKeyRef:
                  name: kubric-agent-credentials
                  key: clusterToken
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            exec:
              command: ["pgrep", "sh"]
            initialDelaySeconds: 5
            periodSeconds: 15
```

### Step 3.7 — Lint it

```bash
helm lint ./charts/kubric-agent
```
Fix anything it flags before moving on — a chart that fails lint will also fail install in ways that are harder to debug from inside `connect.go`'s streamed output.

---

## 4. Wiring It Into `kubric connect`

The only change needed in `connect.go` right now is pointing the Helm command at the local chart path instead of a repo name:

```go
// Before (points at a repo that doesn't exist yet):
helm upgrade --install kubric-agent kubric/kubric-agent --values <file>

// For now, during placeholder testing:
helm upgrade --install kubric-agent ./charts/kubric-agent --values <file>
```

This should be a config value, not a hardcoded string, so switching back to the real repo later is a one-line change. Add a constant near the top of `connect.go`:

```go
const agentChartRef = "./charts/kubric-agent" // TODO: swap to "kubric/kubric-agent" once published
```

---

## 5. Testing Checklist

- [ ] `helm lint ./charts/kubric-agent` passes with no errors
- [ ] `helm install --dry-run` against a local cluster (kind/minikube) renders valid YAML
- [ ] `kubric connect` against a local kind cluster completes the Helm install without error
- [ ] `kubectl get pods -n kubric-system` shows the placeholder pod Running, not CrashLoopBackOff
- [ ] `kubectl logs -n kubric-system deploy/kubric-agent` shows the heartbeat line printing every 30s
- [ ] The Secret's `clusterToken` value matches what was passed through from the backend's `ConnectCluster` response
- [ ] Running `kubric connect` a second time (upgrade path, not fresh install) doesn't break anything

---

## 6. How This Gets Replaced Later

When the real in-cluster agent is ready:

1. Replace `templates/deployment.yaml`'s `image` and `command`/`args` with the real agent binary and its actual entrypoint
2. Add whatever real RBAC (`ClusterRole`, `ClusterRoleBinding`, `ServiceAccount`) the real agent needs to watch pods/events/metrics — none of that exists in this placeholder since it does nothing
3. Keep `values.yaml`'s field names (`clusterToken`, `ingestionEndpoint`, `clusterName`, `image`) exactly as they are, so `connect.go` never has to change
4. Swap the constant in `connect.go` from the local path back to the real published chart reference once it's hosted somewhere real
5. Delete this file's "placeholder" framing from the chart's own README once it's no longer a placeholder

Nothing about the CLI's `connect` command should need to change during this swap — that's the entire point of keeping the values contract stable from day one.

---

*Placeholder Kubric Agent Chart — exists to unblock CLI testing, not to be mistaken for the real thing.*
