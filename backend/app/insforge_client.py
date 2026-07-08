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
                # Fetch fallback user_id if not provided
                if not user_id:
                    try:
                        usr_resp = await client.get(
                            f"{self.base_url}/investigations?select=user_id&limit=1&user_id=not.is.null",
                            headers=self.headers
                        )
                        if usr_resp.status_code == 200 and usr_resp.json():
                            user_id = usr_resp.json()[0].get("user_id")
                    except Exception:
                        pass
                
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

    async def validate_cluster_token(self, cluster_token: str) -> str | None:
        """Validates a cluster_token against the clusters table and returns the associated user_id."""
        if not self.url:
            return None
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/clusters?cluster_token=eq.{cluster_token}&select=user_id",
                    headers=self.headers,
                )
                resp.raise_for_status()
                data = resp.json()
                if data and len(data) > 0:
                    return data[0].get("user_id")
            except Exception as e:
                logger.error(f"Failed to validate cluster token: {e}")
        return None

    async def create_investigation(self, cluster_context: str, user_id: str = None) -> str | None:
        """Create a new investigation record from a push agent."""
        if not self.url:
            return None
            
        async with httpx.AsyncClient() as client:
            try:
                # Prefer: return=representation tells PostgREST to return the inserted row
                headers = {**self.headers, "Prefer": "return=representation"}
                payload = {
                    "cluster_context": cluster_context,
                    "status": "running"
                }
                
                if user_id:
                    payload["user_id"] = user_id
                else:
                    logger.warning("No user_id provided for investigation creation. RLS policies may hide this row.")
                    payload["user_id"] = user_id
                
                resp = await client.post(
                    f"{self.base_url}/investigations",
                    headers=headers,
                    json=payload
                )
                resp.raise_for_status()
                data = resp.json()
                if data and len(data) > 0:
                    logger.info(f"Created new investigation {data[0].get('id')}")
                    return data[0].get("id")
            except Exception as e:
                logger.error(f"Failed to create investigation: {e}")
                if hasattr(e, 'response') and e.response:
                    logger.error(f"Response: {e.response.text}")
        return None
