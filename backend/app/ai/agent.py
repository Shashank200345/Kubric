import json
import re
from loguru import logger
from typing import Dict, Any

from .llm import OpenRouterClient
from .prompts import PromptBuilder

class KubernetesAIAgent:
    """Orchestrates LLM reasoning for Kubernetes troubleshooting."""
    
    def __init__(self):
        self.llm = OpenRouterClient()
        self.prompt_builder = PromptBuilder()
        
    def _clean_json_response(self, text: str) -> str:
        """Removes markdown backticks if the LLM includes them."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    async def analyze(self, evidence: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes Kubernetes evidence and returns a structured diagnosis.
        """
        logger.info("Starting AI reasoning on Kubernetes evidence...")
        import json
        logger.info(f"EVIDENCE PAYLOAD: {json.dumps(evidence, indent=2)}")
        
        messages = self.prompt_builder.build_messages(evidence)
        response_text = await self.llm.call_llm(messages)
        
        if not response_text:
            logger.error("No response received from LLM.")
            return self._fallback_diagnosis()
            
        cleaned_json = self._clean_json_response(response_text)
        
        try:
            diagnosis = json.loads(cleaned_json)
            
            # Auto-Fix Guardrails
            suggested_action = diagnosis.get("suggested_action")
            diagnosis["kubectl_command"] = ""
            
            if suggested_action:
                action_type = suggested_action.get("action_type")
                root_cause = diagnosis.get("root_cause", "")
                
                # Layer 1: Deterministic Backstop
                if not self._passes_deterministic_backstop(root_cause, action_type):
                    logger.warning(f"Action {action_type} failed deterministic backstop for root cause: {root_cause}")
                    diagnosis["suggested_action"] = None
                else:
                    # Layer 2: LLM Consistency Check
                    is_plausible = await self._validate_action_plausibility_llm(root_cause, action_type)
                    if not is_plausible:
                        logger.warning(f"Action {action_type} failed LLM plausibility check for root cause: {root_cause}")
                        diagnosis["suggested_action"] = None
                    else:
                        # Success: Generate deterministic kubectl command
                        diagnosis["kubectl_command"] = self._generate_safe_kubectl_command(
                            action_type, 
                            suggested_action.get("params", {})
                        )

            return diagnosis
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Raw response: {response_text}")
            return self._fallback_diagnosis()
            
    def _fallback_diagnosis(self) -> Dict[str, Any]:
        """Fallback returned if the LLM fails or errors out."""
        return {
            "root_cause": "Unable to determine root cause due to AI service failure.",
            "explanation": "The AI reasoning layer failed to process the evidence or timed out.",
            "fix": "Check the Kubernetes evidence manually.",
            "kubectl_command": "",
            "prevention": "Ensure the OpenRouter API key is valid and the service is reachable.",
            "confidence": 0,
            "evidence_used": []
        }

    def _generate_safe_kubectl_command(self, action_type: str, params: Dict[str, Any]) -> str:
        ns = params.get("namespace", "default")
        if action_type == "restart_pod":
            return f"kubectl delete pod {params.get('pod_name', '')} -n {ns}"
        elif action_type == "rollback_deployment":
            rev = f" --to-revision={params.get('target_revision')}" if params.get("target_revision") else ""
            return f"kubectl rollout undo deployment/{params.get('deployment_name', '')} -n {ns}{rev}"
        elif action_type == "update_resource_limits":
            limits = []
            if params.get("cpu_limit"): limits.append(f"cpu={params.get('cpu_limit')}")
            if params.get("memory_limit"): limits.append(f"memory={params.get('memory_limit')}")
            limit_str = ", ".join(limits)
            return f"kubectl set resources deployment/{params.get('deployment_name', '')} -c={params.get('container_name', '')} --limits={limit_str} -n {ns}"
        elif action_type == "scale_deployment":
            return f"kubectl scale deployment/{params.get('deployment_name', '')} --replicas={params.get('replicas', '0')} -n {ns}"
        elif action_type == "update_environment_variable":
            return f"kubectl set env deployment/{params.get('deployment_name', '')} {params.get('env_name', '')}={params.get('env_value', '')} -n {ns}"
        return ""

    def _passes_deterministic_backstop(self, root_cause: str, action_type: str) -> bool:
        root_cause_lower = root_cause.lower()
        if action_type == "update_resource_limits":
            return any(kw in root_cause_lower for kw in ["oom", "memory", "cpu", "resource", "limit"])
        if action_type == "update_environment_variable":
            return any(kw in root_cause_lower for kw in ["env", "environment", "variable", "not set", "missing", "required"])
        if action_type == "scale_deployment":
            return any(kw in root_cause_lower for kw in ["scale", "replica", "traffic", "load", "capacity"])
        return True # Other actions like restart_pod or rollback might apply more generally

    async def _validate_action_plausibility_llm(self, root_cause: str, action_type: str) -> bool:
        prompt = f"""
Given the following root cause for a Kubernetes pod failure:
'{root_cause}'

Does the Kubernetes action '{action_type}' logically and safely address this specific root cause?
Answer strictly YES or NO.
"""
        messages = [{"role": "user", "content": prompt.strip()}]
        try:
            response = await self.llm.call_llm(messages)
            if not response:
                return False
            ans = response.strip().upper()
            if "YES" in ans and "NO" not in ans:
                return True
            return False
        except Exception as e:
            logger.error(f"Error in LLM plausibility check: {e}")
            return False

