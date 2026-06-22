import os
import httpx
from loguru import logger
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

class OpenRouterClient:
    """Client for calling OpenRouter LLM API."""
    
    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
    
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY is not set. AI reasoning will fail.")

    async def call_llm(self, messages: list) -> Optional[str]:
        """
        Calls OpenRouter with the given messages array.
        Handles timeout and basic errors gracefully.
        """
        if not self.api_key:
            return None
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "AI Kubernetes Agent",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "response_format": {"type": "json_object"}
        }
        
        try:
            logger.info(f"Calling OpenRouter API using model: {self.model}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.BASE_URL, headers=headers, json=payload)
                response.raise_for_status()
                
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return content
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from OpenRouter: {e.response.text}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request failed to OpenRouter: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error when calling LLM: {e}")
            return None
