import os
import uuid
import httpx
from loguru import logger


def _is_uuid(value) -> bool:
    """Return True if value is a valid UUID string (the DB keys rows by UUID)."""
    if not value or not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


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

        # session_id is a UUID FK to investigations(id). A non-UUID id (e.g. an
        # optimistic "inv_..." from the client) can never match, so skip the write
        # instead of generating a 400 on every progress step.
        if not _is_uuid(investigation_id):
            logger.debug(f"Skipping progress step — '{investigation_id}' is not a persisted investigation id.")
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
                detail = ""
                if hasattr(e, "response") and getattr(e, "response", None) is not None:
                    detail = f" — {e.response.text}"
                logger.error(f"Failed to insert progress step for {investigation_id}: {e}{detail}")

    async def get_investigation_details(self, investigation_id: str) -> dict | None:
        """Fetch the user_id and cluster_context from the investigations table for a given investigation."""
        if not self.url:
            return None
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/investigations?id=eq.{investigation_id}&select=user_id,cluster_context",
                    headers=self.headers,
                )
                resp.raise_for_status()
                data = resp.json()
                if data:
                    return data[0]
            except Exception as e:
                logger.error(f"Failed to fetch details for {investigation_id}: {e}")
        return None

    async def complete_investigation(self, investigation_id: str, diagnosis: dict):
        """Mark investigation as complete and save the diagnosis."""
        if not self.url:
            return

        if not _is_uuid(investigation_id):
            logger.debug(f"Skipping completion — '{investigation_id}' is not a persisted investigation id.")
            return

        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "status": "completed",
                    "root_cause": diagnosis.get("root_cause"),
                    "explanation": diagnosis.get("explanation"),
                    "fix": diagnosis.get("suggested_fix") or diagnosis.get("fix"),
                    "kubectl_command": diagnosis.get("kubectl_command"),
                    "suggested_action": diagnosis.get("suggested_action"),
                    "confidence": diagnosis.get("confidence"),
                    "evidence_used": diagnosis.get("evidence_used")
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

    async def validate_cluster_token(self, cluster_token: str) -> tuple[str | None, str | None]:
        """Validates a cluster_token against the clusters table and returns (user_id, cluster_name)."""
        if not self.url:
            return None, None
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/clusters?cluster_token=eq.{cluster_token}&select=user_id,cluster_name",
                    headers=self.headers,
                )
                resp.raise_for_status()
                data = resp.json()
                if data and len(data) > 0:
                    return data[0].get("user_id"), data[0].get("cluster_name")
            except Exception as e:
                logger.error(f"Failed to validate cluster token: {e}")
        return None, None

    async def create_action(self, investigation_id: str, action_type: str, params: dict, user_id: str, cluster_name: str) -> dict | None:
        """Create a new action."""
        if not self.url:
            return None
        async with httpx.AsyncClient() as client:
            try:
                headers = {**self.headers, "Prefer": "return=representation"}
                payload = [{
                    "investigation_id": investigation_id,
                    "action_type": action_type,
                    "params": params,
                    "status": "pending",
                    "user_id": user_id,
                    "cluster_name": cluster_name
                }]
                logger.info(f"create_action payload: {payload}")
                resp = await client.post(
                    f"{self.base_url}/actions",
                    headers=headers,
                    json=payload
                )
                resp.raise_for_status()
                data = resp.json()
                return data[0] if data else None
            except Exception as e:
                err_text = ""
                if hasattr(e, "response") and hasattr(e.response, "text"):
                    err_text = e.response.text
                logger.error(f"Failed to create action. Payload: {payload}, Exception: {e}, Response Text: {err_text}")
                raise e

    async def get_pending_actions(self, user_id: str, cluster_name: str) -> list[dict]:
        """Fetch pending actions and mark them as in_progress."""
        if not self.url:
            return []
        async with httpx.AsyncClient() as client:
            try:
                # 1. Fetch pending actions
                resp = await client.get(
                    f"{self.base_url}/actions?user_id=eq.{user_id}&status=eq.pending&select=*",
                    headers=self.headers,
                )
                resp.raise_for_status()
                actions = resp.json()
                
                # 2. Update their status to in_progress to avoid race conditions
                if actions:
                    action_ids = [action['id'] for action in actions]
                    ids_str = ",".join(action_ids)
                    await client.patch(
                        f"{self.base_url}/actions?id=in.({ids_str})",
                        headers=self.headers,
                        json={"status": "in_progress"}
                    )
                
                return actions
            except Exception as e:
                logger.error(f"Failed to fetch pending actions: {e}")
                return []

    async def get_action(self, action_id: str, user_id: str) -> dict | None:
        """Fetch a single action's status/output, scoped to the owning user."""
        if not self.url:
            return None
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/actions?id=eq.{action_id}&user_id=eq.{user_id}&select=status,output",
                    headers=self.headers,
                )
                resp.raise_for_status()
                data = resp.json()
                return data[0] if data else None
            except Exception as e:
                logger.error(f"Failed to fetch action {action_id}: {e}")
                return None

    async def update_action_result(self, action_id: str, status: str, output: dict) -> bool:
        """Update the status and output of an action."""
        if not self.url:
            return False
        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "status": status,
                    "output": output
                }
                # Update by ID regardless of previous status
                resp = await client.patch(
                    f"{self.base_url}/actions?id=eq.{action_id}",
                    headers=self.headers,
                    json=payload
                )
                resp.raise_for_status()
                return True
            except Exception as e:
                logger.error(f"Failed to update action result: {e}")
                return False

    async def upsert_cluster_state(self, user_id: str, cluster_name: str, sections: dict) -> bool:
        """
        Store the latest cluster snapshot pushed by the in-cluster agent.
        Upserts on (user_id, cluster_name) so we always keep the most recent state.
        """
        if not self.url:
            return False
        async with httpx.AsyncClient() as client:
            try:
                payload = {
                    "user_id": user_id,
                    "cluster_name": cluster_name,
                    "pods": sections.get("pods", []),
                    "nodes": sections.get("nodes", []),
                    "workloads": sections.get("workloads", []),
                    "events": sections.get("events", []),
                    "metrics": sections.get("metrics", {}),
                    "logs": sections.get("logs", {}),
                    "collected_at": sections.get("collected_at"),
                    "updated_at": sections.get("collected_at"),
                }
                # PostgREST upsert: POST with merge-duplicates against the unique key.
                headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
                resp = await client.post(
                    f"{self.base_url}/cluster_state?on_conflict=user_id,cluster_name",
                    headers=headers,
                    json=[payload],
                )
                resp.raise_for_status()
                return True
            except Exception as e:
                detail = ""
                if hasattr(e, "response") and getattr(e, "response", None) is not None:
                    detail = f" — {e.response.text}"
                logger.error(f"Failed to upsert cluster state for {cluster_name}: {e}{detail}")
                return False

    async def get_cluster_state(self, cluster_name: str, user_id: str | None = None) -> dict | None:
        """Read the latest stored snapshot for a cluster (optionally scoped to a user)."""
        if not self.url:
            return None
        query = f"cluster_name=eq.{cluster_name}"
        if user_id:
            query += f"&user_id=eq.{user_id}"
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/cluster_state?{query}&order=collected_at.desc&limit=1",
                    headers=self.headers,
                )
                resp.raise_for_status()
                data = resp.json()
                return data[0] if data else None
            except Exception as e:
                logger.error(f"Failed to fetch cluster state for {cluster_name}: {e}")
        return None

    async def list_state_clusters(self, user_id: str | None = None) -> list[str]:
        """List cluster names that have reported state (optionally scoped to a user)."""
        if not self.url:
            return []
        query = "select=cluster_name&order=cluster_name.asc"
        if user_id:
            query += f"&user_id=eq.{user_id}"
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(f"{self.base_url}/cluster_state?{query}", headers=self.headers)
                resp.raise_for_status()
                names = [row.get("cluster_name") for row in resp.json() if row.get("cluster_name")]
                # de-duplicate while preserving order
                seen = set()
                return [n for n in names if not (n in seen or seen.add(n))]
            except Exception as e:
                logger.error(f"Failed to list state clusters: {e}")
        return []

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
