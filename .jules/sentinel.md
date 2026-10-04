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

## 2026-09-09 - Validate JWT `sub` Claim Format Before Using as Database User ID
**Vulnerability:** `get_current_user` in `backend/app/api/onboarding.py` extracted the `sub` claim from authenticated JWTs without validating that it conformed to a UUID format (matching the DB schema `user_id UUID NOT NULL`). A JWT signed with a non-UUID `sub` claim containing PostgREST filter operators (e.g. `sub="user_123,user_id=neq.0"`) could manipulate downstream PostgREST REST query parameters when making admin-privileged DB calls.
**Learning:** Even when JWT signatures are cryptographically verified, extracted claim values used directly in database query filters or REST calls must be validated against expected data types (such as UUIDs).
**Prevention:** Validate `sub` user ID claims against `_is_uuid(user_id)` during JWT authentication dependency checks before returning the user ID.

## 2026-09-10 - Validate `cluster_name` Path Parameter Before PostgREST Filter Formatting
**Vulnerability:** `get_heartbeat` in `backend/app/api/onboarding.py` formatted user-supplied `cluster_name` path parameters directly into PostgREST REST query filter strings (e.g., `cluster_name=eq.{cluster_name}`) using admin API key headers without validating its format. Path inputs containing PostgREST filter operators (e.g., `prod-cluster,id=neq.0`) could manipulate SQL queries against admin database endpoints.
**Learning:** Route parameters used to build REST API filter parameters for PostgREST backend services must be strictly validated against domain regexes (RFC 1123 DNS label rules) to prevent filter injection.
**Prevention:** Enforce RFC 1123 DNS label regex validation (`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`) on `cluster_name` parameters prior to constructing database query URLs.

## 2026-09-11 - Validate cluster_name in InsForgeClient get/upsert cluster_state
**Vulnerability:** `InsForgeClient.get_cluster_state` formatted `cluster_name` directly into PostgREST REST query filter strings (`f"cluster_name=eq.{cluster_name}"`) without validating its format, enabling PostgREST query filter injection when fetching cluster state snapshots.
**Learning:** PostgREST helper methods interpolating resource name strings into REST query filters must validate those parameters before issuing requests to admin-privileged PostgREST endpoints.
**Prevention:** Enforce `_is_cluster_name` regex validation (`^[a-zA-Z0-9_.-]{1,253}$`) on `cluster_name` in `InsForgeClient.get_cluster_state` and `upsert_cluster_state`.

## 2026-09-26 - Reject Leading Dashes in Resource Name Validation Helpers
**Vulnerability:** `_is_cluster_name` validated cluster names against `^[a-zA-Z0-9_.-]{1,253}$`, which permitted strings starting with dashes (e.g. `--all` or `-n`). When used in CLI commands or option parameters, leading dashes trigger option injection.
**Learning:** Generic regexes allowing dashes in resource names can match leading dashes, which are interpreted by CLI programs (like `kubectl`) as flags rather than positional arguments or values.
**Prevention:** Always explicitly reject leading dashes (`value.startswith("-")`) in input validation helper functions for resource names.
## 2026-09-28 - Validate cluster_token and user_id in validate_cluster_token, _record_heartbeat, and create_investigation
**Vulnerability:** `validate_cluster_token`, `_record_heartbeat`, and `create_investigation` formatted raw `cluster_token` and `user_id` string parameters into admin PostgREST REST query filter URLs or database payloads without validating UUID format, exposing admin database queries to filter injection manipulation.
**Learning:** Request header values (such as Bearer tokens or user IDs) passed directly into PostgREST query filter parameter URLs must be strictly validated before issuing admin requests.
**Prevention:** Validate `cluster_token` and `user_id` against `_is_uuid` before executing PostgREST database queries or background heartbeat updates.

## 2026-10-01 - Validate Cluster Context Name Format in KubectlExecutor and Action Builder
**Vulnerability:** `KubectlExecutor.run` and `_build_action_argv` only checked if `context` parameters started with `-` (leading dash check) without validating that `context` conformed to valid cluster name format (`_is_cluster_name`), allowing malformed context parameters with spaces, control characters, or option flags to be passed into subprocess execution or action command builders.
**Learning:** Checking only `context.startswith("-")` allows invalid or option-manipulating context strings that contain spaces or special characters to be passed to CLI command builders.
**Prevention:** Enforce strict domain name/cluster name regex validation (`_is_cluster_name`) on all context parameters before injecting them into `kubectl` arguments or action execution lists.

## 2026-10-05 - Enforce User ID Ownership Scope in update_action_result
**Vulnerability:** `update_action_result` patched action database rows using `f"{self.base_url}/actions?id=eq.{action_id}"` with admin API key headers without scoping the query to the authenticated `user_id`, enabling an attacker with a valid cluster token to tamper with the execution status/output of another user's action ID (IDOR).
**Learning:** Performing database update queries with admin credentials based solely on a record ID allows cross-tenant state manipulation unless explicitly scoped by the owner's `user_id`.
**Prevention:** Always pass and filter by `user_id=eq.{user_id}` on admin PostgREST update queries to guarantee cross-tenant authorization checks.

## 2026-10-12 - Enforce Authentication and Cluster Context Validation on Ask Endpoint
**Vulnerability:** `ask_kubric` (`POST /ask`) allowed unauthenticated clients to invoke AI LLM queries and trigger cluster inspect calls without validating user JWTs or validating `cluster_context` parameter formatting.
**Learning:** Endpoints that execute AI reasoning and cluster state inspection must enforce user authentication and parameter validation to prevent unauthorized LLM usage and context flag injection.
**Prevention:** Verify `_user_id_from_jwt(authorization)` and validate `_is_cluster_name(cluster_context)` on all conversational and reasoning endpoints before executing backend operations.

## 2026-10-18 - Enforce Authentication and Ownership Scope on Investigation Progress Endpoint
**Vulnerability:** `get_investigation_progress` (`GET /investigate/{investigation_id}/progress`) queried the `investigation_progress` table using admin API headers without verifying user JWT authentication or validating user ownership of `investigation_id`, allowing unauthenticated access and cross-tenant information disclosure (IDOR).
**Learning:** Endpoints that query backend records via admin-privileged API keys must verify JWT Bearer tokens and validate resource ownership before executing queries on behalf of users.
**Prevention:** Verify `_user_id_from_jwt(authorization)` and validate `client.get_investigation_details(investigation_id, user_id=user_id)` before querying investigation progress rows.
