import subprocess
import json
from loguru import logger
from typing import Optional, Union, Dict, Any

class KubectlError(Exception):
    pass

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
        
        if context:
            # Insert --context right after kubectl
            parts = command.split(" ", 1)
            if len(parts) == 2 and parts[0] == "kubectl":
                command = f"kubectl --context={context} {parts[1]}"
                
        logger.info(f"Executing: {command}")
        try:
            result = subprocess.run(
                command, 
                shell=True, 
                check=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True
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
            err_output = e.stderr.strip()
            logger.error(f"Command failed: {command}")
            logger.error(f"Error output: {err_output}")
            
            # Beginner friendly errors
            if "refused" in err_output.lower() or "unreachable" in err_output.lower():
                raise KubectlError("Unable to connect to Kubernetes cluster. Please verify your cluster is running and accessible.")
            if "not found" in err_output.lower():
                raise KubectlError("Resource not found in the cluster.")
            if "context" in err_output.lower():
                raise KubectlError(f"Invalid cluster context: {context}. Please check your kubeconfig.")
                
            raise KubectlError(f"Kubernetes command failed: {err_output}")
            
        except Exception as e:
            logger.error(f"Unexpected error executing command: {e}")
            raise KubectlError("An unexpected error occurred while communicating with the cluster.")
