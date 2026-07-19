import subprocess
import json
import time
from loguru import logger
from typing import Optional, Union, Dict, Any

class KubectlError(Exception):
    pass

class ClusterUnreachableError(KubectlError):
    """Raised when the cluster API server cannot be reached (cluster stopped, wrong port, etc.)."""
    pass

def _summarize_stderr(err_output: str) -> str:
    """Collapse noisy multi-line kubectl client errors into a single readable line."""
    lines = [ln.strip() for ln in err_output.splitlines() if ln.strip()]
    # Drop repetitive client-go noise (memcache.go "Unhandled Error" spam)
    meaningful = [ln for ln in lines if "memcache.go" not in ln and "Unhandled Error" not in ln]
    if meaningful:
        return meaningful[-1]
    return lines[-1] if lines else err_output.strip()

# Rate-limit the "cluster unreachable" warning so polling endpoints don't flood the log.
_last_unreachable_log = 0.0
_UNREACHABLE_LOG_INTERVAL = 60.0  # seconds

class KubectlExecutor:
    """Utility to execute kubectl commands safely."""

    @staticmethod
    def run(command: str, parse_json: bool = False, context: Optional[str] = None) -> Union[str, Dict[str, Any]]:
        """
        Runs a kubectl command via subprocess.
        
        Args:
            command: The kubectl command to run (e.g., "kubectl get pods -A").
            parse_json: If True, attempts to parse the output as JSON.
            context: The kubernetes context to use.
            
        Returns:
            The raw string output, parsed JSON dict, or raises KubectlError.
        """
        
        global _last_unreachable_log

        parts = command.split(" ", 1)
        if len(parts) == 2 and parts[0] == "kubectl":
            # Inject --request-timeout so the kubectl process itself times out quickly
            # rather than relying solely on Python's subprocess timeout (which leaves zombies on Windows)
            base_args = "--request-timeout=5s"
            if context:
                base_args += f" --context={context}"
            command = f"kubectl {base_args} {parts[1]}"
                
        logger.info(f"Executing: {command}")
        try:
            result = subprocess.run(
                command, 
                shell=True, 
                check=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True,
                timeout=10
            )
            
            output = result.stdout.strip()
            
            if parse_json:
                try:
                    return json.loads(output) if output else {}
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON output: {e}")
                    raise KubectlError("Failed to parse cluster response.")
                    
            return output
            
        except subprocess.CalledProcessError as e:
            err_output = (e.stderr or "").strip()
            lowered = err_output.lower()

            # Cluster is down / API server refused the connection or is unreachable.
            # This is an environment condition (not a bug), so log it quietly and rarely
            # to avoid flooding the log on every polling request.
            if "refused" in lowered or "unreachable" in lowered or "no such host" in lowered or "i/o timeout" in lowered:
                now = time.monotonic()
                if now - _last_unreachable_log > _UNREACHABLE_LOG_INTERVAL:
                    _last_unreachable_log = now
                    logger.warning(
                        "Kubernetes cluster is unreachable"
                        + (f" (context={context})" if context else "")
                        + ". Is your cluster running? "
                        + _summarize_stderr(err_output)
                    )
                raise ClusterUnreachableError(
                    "Unable to connect to the Kubernetes cluster. Please verify your cluster is running and accessible."
                )

            summary = _summarize_stderr(err_output)
            logger.error(f"Command failed: {command} — {summary}")

            if "not found" in lowered:
                raise KubectlError("Resource not found in the cluster.")
            if "context" in lowered:
                raise KubectlError(f"Invalid cluster context: {context}. Please check your kubeconfig.")

            raise KubectlError(f"Kubernetes command failed: {summary}")

        except subprocess.TimeoutExpired:
            now = time.monotonic()
            if now - _last_unreachable_log > _UNREACHABLE_LOG_INTERVAL:
                _last_unreachable_log = now
                logger.warning(f"kubectl command timed out — the cluster may be unreachable: {command}")
            raise ClusterUnreachableError("Kubernetes command timed out. The cluster may be unreachable.")
            
        except Exception as e:
            logger.error(f"Unexpected error executing command: {e}")
            raise KubectlError("An unexpected error occurred while communicating with the cluster.")
