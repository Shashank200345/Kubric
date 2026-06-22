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
        
        messages = self.prompt_builder.build_messages(evidence)
        response_text = await self.llm.call_llm(messages)
        
        if not response_text:
            logger.error("No response received from LLM.")
            return self._fallback_diagnosis()
            
        cleaned_json = self._clean_json_response(response_text)
        
        try:
            diagnosis = json.loads(cleaned_json)
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
            "confidence": 0
        }
