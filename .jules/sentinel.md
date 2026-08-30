## 2026-08-30 - Prevent Command Injection in KubectlExecutor
**Vulnerability:** `KubectlExecutor.run` executed string commands via `subprocess.run(..., shell=True)` and concatenated the `context` parameter directly into shell command strings, allowing command injection via shell metacharacters in context strings or commands.
**Learning:** Shell-based command execution in helper wrappers introduces command injection risk when arguments or context flags are dynamically formatted into command strings.
**Prevention:** Always use list-based argument arrays with `shell=False` (e.g., using `shlex.split`) when invoking external CLI binaries via subprocess.
