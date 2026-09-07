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

## 2026-09-06 - Reject JWTs When Secret Environment Variable Is Missing
**Vulnerability:** `_user_id_from_jwt` (`backend/app/main.py`) and `get_current_user` (`backend/app/api/onboarding.py`) checked `if secret:` before validating HMAC-SHA256 JWT signatures. If neither `JWT_SECRET` nor `INSFORGE_API_KEY` was configured, `secret` evaluated to empty string, bypassing signature verification and accepting unverified/forged JWTs.
**Learning:** Wrapping signature verification inside `if secret:` causes unconfigured environment secrets to fail open and trust unverified tokens.
**Prevention:** Fail closed when secret key environment variables are missing or empty (`if not secret: return None`), rejecting all incoming tokens until secret configuration is present.

## 2026-09-07 - Validate UUIDs Before Formatting PostgREST Query Filters
**Vulnerability:** `get_investigation_details`, `get_action`, and `update_action_result` in `InsForgeClient`, as well as `get_investigation_progress` in `main.py`, interpolated user-provided ID parameters directly into PostgREST REST query URLs (e.g. `f"actions?id=eq.{action_id}"`) using admin-privileged API keys without validating UUID format. Malicious inputs with PostgREST query parameters or operators enabled query manipulation across database rows.
**Learning:** PostgREST query strings constructed via string interpolation accept commas and query parameters that alter SQL filtering when executing requests with admin service-role credentials.
**Prevention:** Validate ID parameters against `_is_uuid` before formatting PostgREST query strings, safely returning early if the ID format is invalid.
