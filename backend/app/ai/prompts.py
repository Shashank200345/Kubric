import json
from typing import Dict, Any

class PromptBuilder:
    """Builds structured prompts for the Kubernetes AI Agent."""
    
    SYSTEM_PROMPT = """You are a Senior Kubernetes Site Reliability Engineer (SRE).
Your job is to troubleshoot cluster issues based on evidence gathered by a junior engineer.
You are given structured JSON containing data about pods, logs, events, deployments, and networking.

You must correlate this evidence and find the root cause.
Always respond in purely valid JSON, matching the following structure exactly:

{
    "root_cause": "<a concise 1-sentence root cause>",
    "explanation": "<detailed explanation of what went wrong based on the evidence>",
    "fix": "<practical, actionable fix recommendation>",
    "kubectl_command": "<the exact kubectl command the user should run to investigate or fix this, or empty string>",
    "prevention": "<recommendation on how to prevent this in the future>",
    "confidence": <integer between 0 and 100 representing your confidence in this diagnosis>
}

Do not include markdown ticks like ```json. Return only the JSON object.
"""

    def build_messages(self, evidence: Dict[str, Any]) -> list:
        """
        Constructs the messages array for the LLM.
        """
        evidence_json = json.dumps(evidence, indent=2)
        
        user_prompt = f"""Here is the Kubernetes investigation evidence:

{evidence_json}

Please analyze this evidence and provide the diagnosis JSON."""

        return [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]
