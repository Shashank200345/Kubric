import os
import httpx
from loguru import logger

class InsForgeClient:
    """Client for interacting with InsForge REST API from the backend."""
    
    def __init__(self, user_jwt: str = None):
        self.url = os.getenv("INSFORGE_URL")
        # Admin API key for server-side operations (bypasses RLS)
        self.api_key = os.getenv("INSFORGE_API_KEY")
        
        if not self.url or not self.api_key:
            logger.warning("INSFORGE_URL or INSFORGE_API_KEY is not set.")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        # InsForge uses /api/database/records/{table} for PostgREST operations
        self.base_url = f"{self.url}/api/database/records"

    async def update_progress(self, investigation_id: str, step: str, user_id: str = None):
        """
        Insert a progress step into the investigation_progress table.
        This triggers a realtime event that the frontend listens to.
        """
        if not self.url:
            return
            
        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "session_id": investigation_id,
                    "step": step,
                    "status": "running",
                }
                if user_id:
                    payload["user_id"] = user_id

                resp = await client.post(
                    f"{self.base_url}/investigation_progress",
                    headers=self.headers,
                    json=payload
                )
                resp.raise_for_status()
                logger.info(f"Progress step inserted for {investigation_id}: '{step}'")
            except Exception as e:
                logger.error(f"Failed to insert progress step for {investigation_id}: {e}")

    async def get_investigation_user(self, investigation_id: str) -> str | None:
        """Fetch the user_id from the investigations table for a given investigation."""
        if not self.url:
            return None
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/investigations?id=eq.{investigation_id}&select=user_id",
                    headers=self.headers,
                )
                resp.raise_for_status()
                data = resp.json()
                if data:
                    return data[0].get("user_id")
            except Exception as e:
                logger.error(f"Failed to fetch user_id for {investigation_id}: {e}")
        return None

    async def complete_investigation(self, investigation_id: str, diagnosis: dict):
        """Mark investigation as complete and save the diagnosis."""
        if not self.url:
            return
            
        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "status": "completed",
                    "root_cause": diagnosis.get("root_cause"),
                    "explanation": diagnosis.get("explanation"),
                    "fix": diagnosis.get("suggested_fix") or diagnosis.get("fix"),
                    "kubectl_command": diagnosis.get("kubectl_command"),
                    "confidence": diagnosis.get("confidence")
                }
                
                patch_resp = await client.patch(
                    f"{self.base_url}/investigations?id=eq.{investigation_id}",
                    headers=self.headers,
                    json=payload
                )
                patch_resp.raise_for_status()
                logger.info(f"Completed investigation {investigation_id}")
            except Exception as e:
                logger.error(f"Failed to complete investigation {investigation_id}: {e}")
