## 2026-08-30 - Prevent Command Injection in KubectlExecutor
**Vulnerability:** `KubectlExecutor.run` executed string commands via `subprocess.run(..., shell=True)` and concatenated the `context` parameter directly into shell command strings, allowing command injection via shell metacharacters in context strings or commands.
**Learning:** Shell-based command execution in helper wrappers introduces command injection risk when arguments or context flags are dynamically formatted into command strings.
**Prevention:** Always use list-based argument arrays with `shell=False` (e.g., using `shlex.split`) when invoking external CLI binaries via subprocess.

## 2026-08-31 - Prevent Flag Injection in Kubectl Action Builder
**Vulnerability:** `_build_action_argv` constructed kubectl argument arrays without validating whether resource names or environment variable names started with dashes or flags (e.g. `env_name="--all"` or `pod_name="--all"`), enabling option injection attacks that alter CLI parameter parsing.
**Learning:** Even when avoiding `shell=True`, CLI binaries (like `kubectl`) can interpret arguments starting with `-` as options/flags rather than positional arguments or values.
**Prevention:** Validate resource names and environment variable names against strict regex patterns (e.g., `^[A-Za-z_][A-Za-z0-9_]*$` for environment variables) and reject parameter values starting with `-`.
