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

    async def call_with_tools(
        self,
        messages: list,
        tools: Optional[list] = None,
        force_json: bool = False,
        temperature: float = 0.0,
        timeout: float = 45.0,
    ) -> Optional[Dict[str, Any]]:
        """Tool-calling chat completion for the ReAct loop.

        Returns the raw assistant message dict (may contain `tool_calls`) plus
        token usage, or None on failure. Kept separate from call_llm so the
        existing one-shot JSON path is untouched.
        """
        if not self.api_key:
            return None

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "AI Kubernetes Agent",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        if force_json:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(self.BASE_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                choice = data["choices"][0]
                return {
                    "message": choice["message"],
                    "finish_reason": choice.get("finish_reason"),
                    "usage": data.get("usage", {}),
                }
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from OpenRouter (tools): {e.response.text}")
            return None
        except httpx.RequestError as e:
            logger.error(f"Request failed to OpenRouter (tools): {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error when calling LLM (tools): {e}")
            return None
