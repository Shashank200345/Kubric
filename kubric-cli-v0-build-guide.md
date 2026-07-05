# Building the Kubric CLI (v0) — Step-by-Step Build Guide

> Scope: **only two commands** — `kubric connect` and `kubric status`.
> Everything else from the full CLI spec (`kubric-cli-spec.md`) is Phase 3 and out of scope here.
> This document is written so you can hand each numbered step directly to an AI coding
> tool (Claude Code, Cursor, Windsurf) as a prompt, in order.

---

## Table of Contents

1. [Why Only Two Commands](#1-why-only-two-commands)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Backend API Contract Needed First](#4-backend-api-contract-needed-first)
5. [Build Steps — In Order](#5-build-steps--in-order)
6. [Testing Checklist](#6-testing-checklist)
7. [Packaging & Distribution](#7-packaging--distribution)
8. [What's Deliberately Not Built Yet](#8-whats-deliberately-not-built-yet)

---

## 1. Why Only Two Commands

`kubric connect` removes the one piece of real friction a web-only flow has — getting the in-cluster agent installed and the cluster linked. `kubric status` gives early reviewers something simple to run afterward so the CLI feels real, without you building the risk engine's terminal interface yet.

Everything else — `ask`, `review --pr`, `diagnose`, `fix`, `playbooks` — stays in the web app. Do not add commands beyond these two without deliberately re-opening that scope decision.

---

## 2. Prerequisites

Before starting, make sure these are installed on your machine:

```bash
go version        # need Go 1.21+
helm version       # need Helm 3.x — connect will shell out to this
kubectl version --client
gh --version       # optional, useful for testing GitHub-related auth patterns later
```

Create the project:

```bash
mkdir kubric-cli && cd kubric-cli
go mod init github.com/<your-org>/kubric-cli
```

Install the two libraries you'll need:

```bash
go get github.com/spf13/cobra@latest
go get github.com/spf13/viper@latest
```

**Why these two:** `cobra` is the exact library `kubectl` and `helm` are built with — using it means `kubric connect --cluster foo` will parse and behave exactly the way engineers already expect from tools they use daily. `viper` handles reading and writing the config file at `~/.kubric/config.yaml` cleanly.

---

## 3. Project Structure

Set this up before writing any command logic:

```
kubric-cli/
├── main.go
├── cmd/
│   ├── root.go          ← cobra root command, global flags
│   ├── connect.go       ← kubric connect
│   ├── status.go        ← kubric status
│   └── login.go         ← kubric login (needed before connect/status can auth)
├── internal/
│   ├── api/
│   │   └── client.go    ← typed HTTP client to talk to Kubric's backend
│   ├── config/
│   │   └── config.go    ← reads/writes ~/.kubric/config.yaml
│   └── output/
│       └── human.go     ← terminal print helpers, simple color handling
├── go.mod
└── go.sum
```

**PROMPT — give this to your AI coding tool to scaffold the structure:**

```
Create a Go CLI project using the cobra library with this exact file structure:

kubric-cli/
├── main.go
├── cmd/
│   ├── root.go
│   ├── connect.go
│   ├── status.go
│   └── login.go
├── internal/
│   ├── api/client.go
│   ├── config/config.go
│   └── output/human.go

main.go should just call cmd.Execute().
root.go should define the root cobra command named "kubric" with a short
description "The Kubric CLI — pre-deployment intelligence for Kubernetes."
Add a persistent flag --json (bool) on the root command for future use,
even though no command uses it yet.
Register connect.go, status.go, and login.go as subcommands of root.
Leave the command bodies as TODO stubs for now — just get the structure
compiling with `go build ./...`.
```

---

## 4. Backend API Contract Needed First

The CLI is a thin client — it needs exactly three backend endpoints to exist before any command logic can be finished. Confirm these are ready (or stub them) before writing `connect.go` and `status.go` for real:

```
POST /v1/auth/device
  → starts the device auth flow, returns a verification URL + device code

POST /v1/auth/device/token
  → polled by the CLI until the user approves in the browser, returns the auth token

POST /v1/clusters/connect
  Body: { "cluster_name": "production-mumbai" }
  → registers the cluster with Kubric, returns a Helm values snippet
    (agent version, ingestion endpoint, per-cluster token) the CLI needs
    to actually run the Helm install

GET /v1/status
  Header: Authorization: Bearer <token>
  Query: ?cluster=production-mumbai
  → returns { health_score, active_incidents, pods_running, pods_total,
              prs_pending, last_synced_seconds_ago }
```

If these don't exist yet on the backend, stub them with a mock server for local CLI development — don't block CLI work waiting on backend work, but don't build CLI logic against imagined response shapes either. Agree on the exact JSON shape with whoever owns the backend before writing `client.go`.

---

## 5. Build Steps — In Order

### Step 5.1 — Config file reader/writer

**What it does:** reads and writes `~/.kubric/config.yaml`, which stores the auth token and the active cluster name. Nothing else lives here — no cluster telemetry, no secrets from the cluster itself.

**PROMPT:**
```
In internal/config/config.go, using viper, implement a Config struct with fields:
  Token         string `mapstructure:"token"`
  Email         string `mapstructure:"email"`
  ActiveCluster string `mapstructure:"active_cluster"`

Implement:
  - Load() (*Config, error)   — reads from ~/.kubric/config.yaml, returns
    an empty Config with no error if the file doesn't exist yet
  - Save(cfg *Config) error   — writes the file, creates ~/.kubric/ directory
    if missing, and sets file permissions to 0600 since it contains an auth token
  - Path() string             — returns the full expanded path to the config file

Do not store any Kubernetes cluster data, telemetry, or secrets in this file —
only the auth token, email, and active cluster name.
```

**Test it manually:** write a tiny throwaway `main()` that calls `Save` then `Load` and prints the result, confirm the file appears at `~/.kubric/config.yaml` with `0600` permissions (`ls -la ~/.kubric/`).

---

### Step 5.2 — API client

**What it does:** the only place in the CLI that makes HTTP requests. Every command calls through this, nothing calls `net/http` directly outside this file.

**PROMPT:**
```
In internal/api/client.go, implement a Client struct with:
  - BaseURL string (default "https://api.kubric.dev")
  - Token   string
  - httpClient *http.Client with a 15 second timeout

Implement these methods:
  - NewClient(token string) *Client
  - StartDeviceAuth() (verificationURL string, deviceCode string, err error)
      POSTs to /v1/auth/device, parses { "verification_url": "...", "device_code": "..." }
  - PollDeviceToken(deviceCode string) (token string, email string, err error)
      POSTs to /v1/auth/device/token with { "device_code": deviceCode }
      Returns a specific error type ErrAuthPending if the response is 428,
      so the caller knows to keep polling rather than fail.
  - ConnectCluster(clusterName string) (helmValues map[string]string, err error)
      POSTs to /v1/clusters/connect with { "cluster_name": clusterName }
      Requires Token to be set — return an error immediately if Token is empty.
  - GetStatus(clusterName string) (*StatusResponse, error)
      GETs /v1/status?cluster=<clusterName>
      Requires Token to be set.

Define StatusResponse struct matching:
  { health_score int, active_incidents int, pods_running int,
    pods_total int, prs_pending int, last_synced_seconds_ago int }

Every method should return a wrapped error with context (e.g. "connecting
cluster: %w") so failures are debuggable, never a bare error.
```

---

### Step 5.3 — `kubric login`

**What it does:** the device auth flow — opens a browser, polls until the person approves.

**PROMPT:**
```
Implement cmd/login.go as a cobra command named "login".

Behavior:
1. Call client.StartDeviceAuth() using an unauthenticated client
   (BaseURL only, no token yet)
2. Print to the terminal:
     "→ Opening browser to approve login..."
     "→ If it doesn't open automatically, visit: <verification_url>"
3. Attempt to open the URL in the default browser (use a small helper
   function that runs `open` on macOS, `xdg-open` on Linux, `start` on
   Windows — detect via runtime.GOOS)
4. Poll client.PollDeviceToken(deviceCode) every 2 seconds, up to a
   60 second timeout. While waiting, print a single line that updates
   in place, e.g. "Waiting for approval..." with a simple spinner character
   that changes each tick (use \r to overwrite the line, not print new lines).
5. On success, save the token and email into the config file via
   internal/config, then print:
     "✓ Logged in as <email>"
6. On timeout, print a clear error: "Login timed out. Run `kubric login` to try again."
   and exit with a non-zero status code.

Do not print the raw token to the terminal at any point.
```

---

### Step 5.4 — `kubric connect`

**What it does:** the one command that does a real side effect — installs the agent via Helm and registers the cluster.

**PROMPT:**
```
Implement cmd/connect.go as a cobra command named "connect".

Behavior, in order:
1. Load config via internal/config. If no token is present, print
   "Run `kubric login` first." and exit with a non-zero status code.
2. Run `kubectl config get-contexts -o name` via os/exec to list available
   kube contexts. Parse the output into a list of cluster names.
   If there are zero, error out clearly: "No Kubernetes clusters found in
   your kubeconfig."
   If there is exactly one, select it automatically and print which one
   was auto-selected.
   If there are multiple, prompt interactively: print a numbered list and
   read the user's choice from stdin.
3. Call client.ConnectCluster(selectedClusterName) using the authenticated
   client (token from config). This returns a map of Helm values
   (things like agent image tag, ingestion endpoint URL, per-cluster token).
4. Write those Helm values to a temporary file (os.CreateTemp), formatted
   as YAML.
5. Shell out to:
     helm upgrade --install kubric-agent kubric/kubric-agent \
       --namespace kubric-system --create-namespace \
       --values <the temp file path>
   Stream the Helm command's stdout/stderr live to the terminal as it runs
   (don't buffer and dump it all at once — the install takes ~30-60s and
   the person should see it's actively doing something).
6. On success, update the config file's ActiveCluster field to the
   selected cluster name and save it.
7. Print a final summary:
     "✓ Kubric is watching your cluster"
     "  Run `kubric status` to check on it."
8. Clean up the temp file (os.Remove) in a defer, whether or not the
   Helm command succeeded.

If the Helm command fails, print its stderr output directly to the user
(don't swallow it) along with a clear message that the connect failed,
and exit non-zero. Do not attempt to auto-retry.
```

**Why this design matters:** notice the Helm install output streams live rather than being buffered — that's a deliberate UX decision. A 40-second install with no terminal output looks broken; showing Helm's real progress reassures the person it's actually doing something.

---

### Step 5.5 — `kubric status`

**What it does:** the simple read-only command — calls the backend, prints a snapshot.

**PROMPT:**
```
Implement cmd/status.go as a cobra command named "status".

Behavior:
1. Load config. If no token, print "Run `kubric login` first." and exit
   non-zero. If no ActiveCluster is set, print "Run `kubric connect`
   first." and exit non-zero.
2. Call client.GetStatus(cfg.ActiveCluster).
3. Print output in this exact format:

   <cluster name> · synced <last_synced_seconds_ago>s ago
   Health score: <health_score>  (color it: green if >=80, yellow if
   60-79, red if <60 — use internal/output helpers, not raw ANSI codes
   inline in this file)
   Active incidents: <active_incidents>
   Pods: <pods_running>/<pods_total> running
   Open PRs pending review: <prs_pending>

4. If the API call fails (network error, 401, etc.), print a clear
   message distinguishing "not logged in" (suggest `kubric login`) from
   a generic network failure (suggest checking connection and retrying),
   and exit non-zero in either case.
```

---

### Step 5.6 — Output helpers

**PROMPT:**
```
Implement internal/output/human.go with small helper functions used by
status.go and connect.go:

  - Success(msg string)   — prints "✓ <msg>" in green if the terminal
    supports color (check via checking if os.Stdout is a terminal,
    using a simple isatty check), plain text otherwise
  - Error(msg string)     — prints "✗ <msg>" in red, same color-detection logic
  - Info(msg string)      — prints "→ <msg>" in default color
  - ColorizeHealthScore(score int) string — returns the score as a string
    wrapped in green/yellow/red ANSI codes based on the thresholds
    described in step 5.5, or plain text if color isn't supported

Keep this file dependency-free — use raw ANSI escape codes
(\033[32m for green, \033[33m for yellow, \033[31m for red, \033[0m to
reset) rather than pulling in a new library, since this CLI only needs
a handful of colors.
```

---

## 6. Testing Checklist

Go through this list manually before giving the binary to any early reviewer:

- [ ] `kubric login` opens a browser and completes successfully with a real account
- [ ] `kubric login` run a second time while already logged in doesn't break anything
- [ ] `kubric connect` with zero clusters in kubeconfig shows a clear error, doesn't panic
- [ ] `kubric connect` with exactly one cluster auto-selects it correctly
- [ ] `kubric connect` with multiple clusters shows a working interactive picker
- [ ] `kubric connect` shows live Helm output, not a long silent pause
- [ ] `kubric connect` failure (bad kubeconfig, no cluster access) shows Helm's real error, not a swallowed generic one
- [ ] `kubric status` before any `connect` tells the user to run `connect` first, not a confusing API error
- [ ] `kubric status` after a successful connect shows real numbers matching what the web dashboard shows for the same cluster
- [ ] Config file at `~/.kubric/config.yaml` has `0600` permissions and never contains cluster secrets
- [ ] Running any command with no internet connection fails with a readable message, not a stack trace

---

## 7. Packaging & Distribution

Once the two commands work end to end:

```bash
# Cross-compile for the common platforms your early reviewers will use
GOOS=darwin  GOARCH=amd64 go build -o dist/kubric-darwin-amd64   .
GOOS=darwin  GOARCH=arm64 go build -o dist/kubric-darwin-arm64   .
GOOS=linux   GOARCH=amd64 go build -o dist/kubric-linux-amd64    .
```

For the install script at `get.kubric.dev`, a simple shell script that detects OS/arch and downloads the right binary is enough for now — don't build a package-manager release (Homebrew formula, apt repo) until you have enough users asking for it. That's real but unnecessary scope for a two-command CLI going to your first handful of reviewers.

**PROMPT to generate the install script:**
```
Write a POSIX shell script (install.sh) that:
1. Detects OS (darwin/linux) and architecture (amd64/arm64) using
   `uname -s` and `uname -m`
2. Downloads the matching binary from
   https://github.com/<org>/kubric-cli/releases/latest/download/kubric-<os>-<arch>
3. Makes it executable and moves it to /usr/local/bin/kubric
   (fall back to $HOME/.local/bin if /usr/local/bin isn't writable
   without sudo, and print a note to add that to PATH if needed)
4. Prints "✓ kubric installed. Run `kubric login` to get started."
   at the end
Keep it dependency-free — no curl | bash tricks beyond the standard
"curl -sSL <url> | sh" pattern, and no reliance on anything beyond
POSIX shell builtins plus curl.
```

---

## 8. What's Deliberately Not Built Yet

Do not add these until the full CLI spec's Phase 3 timing is actually reached:

- `kubric ask`, `kubric diagnose`, `kubric review --pr`, `kubric diff`, `kubric predict`
- `kubric fix preview` / `kubric fix apply` and any trust-gradient logic
- `kubric playbooks`
- `--json` output on any command (nothing to script against yet with only two commands)
- CI/CD integration of any kind
- Any local reasoning or diagnosis logic — this CLI only ever talks to the backend for the two things it does

If you find yourself wanting to add a third command before your first 5 reviewers have given feedback on `connect` and `status`, stop and ask whether that's solving a real problem someone told you about, or scope creep repeating the same pattern this project has caught and corrected twice already.

---

*Kubric CLI v0 Build Guide — two commands, one job each: get connected, check status.*
