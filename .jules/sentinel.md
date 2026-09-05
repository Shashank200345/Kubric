## 2026-08-30 - Prevent Command Injection in KubectlExecutor
**Vulnerability:** `KubectlExecutor.run` executed string commands via `subprocess.run(..., shell=True)` and concatenated the `context` parameter directly into shell command strings, allowing command injection via shell metacharacters in context strings or commands.
**Learning:** Shell-based command execution in helper wrappers introduces command injection risk when arguments or context flags are dynamically formatted into command strings.
**Prevention:** Always use list-based argument arrays with `shell=False` (e.g., using `shlex.split`) when invoking external CLI binaries via subprocess.

## 2026-08-31 - Prevent Flag Injection in Kubectl Action Builder
**Vulnerability:** `_build_action_argv` constructed kubectl argument arrays without validating whether resource names or environment variable names started with dashes or flags (e.g. `env_name="--all"` or `pod_name="--all"`), enabling option injection attacks that alter CLI parameter parsing.
**Learning:** Even when avoiding `shell=True`, CLI binaries (like `kubectl`) can interpret arguments starting with `-` as options/flags rather than positional arguments or values.
**Prevention:** Validate resource names and environment variable names against strict regex patterns (e.g., `^[A-Za-z_][A-Za-z0-9_]*$` for environment variables) and reject parameter values starting with `-`.

## 2026-09-01 - Prevent Flag Injection in LogsCollector and Context Parameter
**Vulnerability:** `LogsCollector` formatted pod `name` and `namespace` into `kubectl logs` command strings without validating whether they started with dashes or flags (e.g., `name="--all"`), allowing CLI option injection. Additionally, `KubectlExecutor.run` allowed context parameters starting with `-`.
**Learning:** Inspecting pod logs or cluster state with parameters sourced from inputs can trigger CLI option injection if positional arguments are not checked for leading dashes or validated against expected resource name schemas.
**Prevention:** Enforce RFC 1123 DNS subdomain name regex (`^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$`) on pod/namespace resource names before constructing CLI commands, and reject context flags starting with `-`.
## 2026-09-01 - Enforce Cryptographic JWT Signature & Expiration Verification
**Vulnerability:** `get_current_user` in `backend/app/api/onboarding.py` extracted the `sub` user ID claim from Bearer JWTs by unverified base64 decoding of the payload without validating the HMAC-SHA256 signature, `alg` header, or `exp` timestamp, allowing arbitrary user impersonation and signature bypass.
**Learning:** Merely parsing JSON payload claims from JWT strings without verifying HMAC signatures or algorithm headers opens API endpoints to signature forgery and authentication bypass attacks.
**Prevention:** Always cryptographically verify HMAC signatures (`HS256`) against a secret using constant-time comparison (`hmac.compare_digest`), enforce `alg` header checks, and validate token expiration timestamps (`exp`).
