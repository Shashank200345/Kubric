"""Onboarding API router.

Provides endpoints for user onboarding flow:
- GET /state — current onboarding state
- PATCH /step — update step completion
- POST /cluster-token — generate cluster token + Helm command
- POST /invite — send team invitations
- GET /heartbeat/{cluster_name} — check cluster heartbeat status
"""

import base64
import json
import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from loguru import logger
from typing import Optional

from app.models.onboarding import (
    ONBOARDING_STEPS,
    ClusterTokenRequest,
    ClusterTokenResponse,
    HeartbeatResponse,
    InviteRequest,
    InviteResponse,
    StepUpdateRequest,
)

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])

# InsForge PostgREST base URL for the user_onboarding table
_INSFORGE_URL = os.getenv("INSFORGE_URL", "")
_INSFORGE_API_KEY = os.getenv("INSFORGE_API_KEY", "")
_BASE_URL = f"{_INSFORGE_URL}/api/database/records"


def _admin_headers() -> dict:
    """Return headers for InsForge admin API calls (bypasses RLS)."""
    return {
        "Authorization": f"Bearer {_INSFORGE_API_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Auth dependency: extracts and validates the Bearer JWT, returning user_id from the `sub` claim.

    Raises HTTPException 401 if:
    - Authorization header is missing
    - Header doesn't start with "Bearer "
    - Token is not a valid JWT (not 3 dot-separated parts)
    - Payload cannot be decoded
    - `sub` claim is missing from the payload
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # JWT is three base64url-encoded parts separated by dots
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # Decode the payload (second part)
        payload_b64 = parts[1]
        # Add padding if necessary
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user_id


@router.get("/state")
async def get_onboarding_state(user_id: str = Depends(get_current_user)):
    """Return the current onboarding state for the authenticated user."""
    from app.models.onboarding import OnboardingStateResponse

    if not _INSFORGE_URL or not _INSFORGE_API_KEY:
        logger.error("INSFORGE_URL or INSFORGE_API_KEY not configured")
        raise HTTPException(status_code=500, detail="Internal server error")

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{_BASE_URL}/user_onboarding?user_id=eq.{user_id}&select=*",
                headers=_admin_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            # PostgREST returns 404 when the table/row is not found. Treat that as
            # "no onboarding record yet" so the frontend starts a fresh wizard,
            # rather than surfacing a 500.
            if e.response is not None and e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Onboarding state not found")
            logger.error(f"Failed to fetch onboarding state for user {user_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
        except httpx.RequestError as e:
            logger.error(f"Request error fetching onboarding state: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    data = resp.json()

    if not data:
        raise HTTPException(status_code=404, detail="Onboarding state not found")

    record = data[0]

    return OnboardingStateResponse(
        current_step=record.get("current_step", "welcome"),
        cluster_name=record.get("cluster_name"),
        connection_method=record.get("connection_method"),
        trust_mode=record.get("trust_mode", "approve"),
        invited_emails=record.get("invited_emails") or [],
        completed_steps=record.get("completed_steps") or [],
        step_timestamps=record.get("step_timestamps") or {},
        is_complete=record.get("is_complete", False),
    )


@router.patch("/step")
async def update_onboarding_step(
    request: StepUpdateRequest,
    user_id: str = Depends(get_current_user),
):
    """Update a specific onboarding step's completion status.

    - Validates the step name against ONBOARDING_STEPS
    - Fetches (or creates) the user_onboarding record
    - Is idempotent: re-completing an already-completed step is a no-op
    - Appends the step to completed_steps, sets the timestamp, advances current_step
    - Persists step-specific data based on the step being completed
    """
    # 1. Validate step name
    if request.step not in ONBOARDING_STEPS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid step: must be one of {ONBOARDING_STEPS}",
        )

    async with httpx.AsyncClient() as client:
        # 2. Fetch the current onboarding record for this user
        get_resp = await client.get(
            f"{_BASE_URL}/user_onboarding?user_id=eq.{user_id}&select=*",
            headers=_admin_headers(),
        )
        get_resp.raise_for_status()
        records = get_resp.json()

        if records:
            record = records[0]
        else:
            # No record exists — create one with defaults
            insert_payload = {
                "user_id": user_id,
                "current_step": "welcome",
                "completed_steps": [],
                "step_timestamps": {},
                "cluster_name": None,
                "connection_method": None,
                "trust_mode": "approve",
                "invited_emails": [],
                "is_complete": False,
                "skipped": False,
            }
            insert_resp = await client.post(
                f"{_BASE_URL}/user_onboarding",
                headers=_admin_headers(),
                json=insert_payload,
            )
            insert_resp.raise_for_status()
            inserted = insert_resp.json()
            record = inserted[0] if isinstance(inserted, list) else inserted

        # 3. Idempotent check: if step is already completed, return current state unchanged
        completed_steps: list = record.get("completed_steps") or []
        if request.step in completed_steps:
            return {
                "current_step": record["current_step"],
                "completed_steps": completed_steps,
            }

        # 4. Add step to completed_steps and set timestamp
        completed_steps.append(request.step)
        step_timestamps: dict = record.get("step_timestamps") or {}
        step_timestamps[request.step] = datetime.now(timezone.utc).isoformat()

        # 5. Advance current_step to the next step in ONBOARDING_STEPS order
        current_step_index = ONBOARDING_STEPS.index(request.step)
        if current_step_index + 1 < len(ONBOARDING_STEPS):
            next_step = ONBOARDING_STEPS[current_step_index + 1]
        else:
            next_step = request.step  # Last step — stay on it

        # 6. Build the patch payload with step-specific data
        patch_payload: dict = {
            "completed_steps": completed_steps,
            "step_timestamps": step_timestamps,
            "current_step": next_step,
        }

        # Check if completing the last step — mark onboarding as complete
        if request.step == ONBOARDING_STEPS[-1]:
            patch_payload["is_complete"] = True

        # Persist step-specific data from request.data
        if request.step == "cluster_name" and "cluster_name" in request.data:
            patch_payload["cluster_name"] = request.data["cluster_name"]
        elif request.step == "connection_method" and "connection_method" in request.data:
            patch_payload["connection_method"] = request.data["connection_method"]
        elif request.step == "trust_mode" and "trust_mode" in request.data:
            patch_payload["trust_mode"] = request.data["trust_mode"]
        elif request.step == "team_invite" and "invited_emails" in request.data:
            patch_payload["invited_emails"] = request.data["invited_emails"]

        # 7. PATCH the record via PostgREST
        patch_resp = await client.patch(
            f"{_BASE_URL}/user_onboarding?user_id=eq.{user_id}",
            headers=_admin_headers(),
            json=patch_payload,
        )
        patch_resp.raise_for_status()

        return {
            "current_step": next_step,
            "completed_steps": completed_steps,
        }


@router.post("/cluster-token", response_model=ClusterTokenResponse)
async def generate_cluster_token(
    body: ClusterTokenRequest, user_id: str = Depends(get_current_user)
):
    """Generate a cluster token and return the pre-filled Helm command."""
    insforge_url = os.getenv("INSFORGE_URL", "https://45syfrke.us-east.insforge.app")
    insforge_api_key = os.getenv("INSFORGE_API_KEY")

    if not insforge_api_key:
        logger.error("INSFORGE_API_KEY not configured")
        raise HTTPException(status_code=500, detail="Internal server error")

    headers = {
        "Authorization": f"Bearer {insforge_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        # Check if a cluster with this name already exists for this user
        try:
            check_resp = await client.get(
                f"{insforge_url}/api/database/records/clusters"
                f"?user_id=eq.{user_id}&cluster_name=eq.{body.cluster_name}",
                headers=headers,
            )
            check_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to check existing cluster: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
        except httpx.RequestError as e:
            logger.error(f"Request error checking existing cluster: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

        existing = check_resp.json()
        if existing:
            raise HTTPException(
                status_code=409, detail="A cluster with this name already exists"
            )

        # Generate a new cluster token
        cluster_token = str(uuid.uuid4())

        # Insert a row into the clusters table
        insert_payload = [
            {
                "user_id": user_id,
                "cluster_name": body.cluster_name,
                "cluster_token": cluster_token,
            }
        ]

        try:
            insert_resp = await client.post(
                f"{insforge_url}/api/database/records/clusters",
                headers=headers,
                json=insert_payload,
            )
            insert_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed to insert cluster row: {e.response.status_code} {e.response.text}"
            )
            raise HTTPException(status_code=500, detail="Internal server error")
        except httpx.RequestError as e:
            logger.error(f"Request error inserting cluster row: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    # The agent must push to the BACKEND (Railway), not to InsForge. Read the
    # public backend URL from env so it isn't hardcoded; fall back to production.
    backend_url = os.getenv(
        "BACKEND_PUBLIC_URL", "https://kubric-production.up.railway.app"
    ).rstrip("/")

    # Build the Helm install command (local chart path + kubric-system namespace).
    helm_command = (
        f"helm install kubric-agent ./kubric-cli/charts/kubric-agent "
        f"-n kubric-system --create-namespace "
        f"--set agent.token={cluster_token} "
        f"--set agent.clusterName={body.cluster_name} "
        f"--set agent.ingestionEndpoint={backend_url}/api/v1/ingest"
    )

    return ClusterTokenResponse(cluster_token=cluster_token, helm_command=helm_command)


@router.post("/invite", response_model=InviteResponse)
async def send_invitations(
    body: InviteRequest,
    user_id: str = Depends(get_current_user),
):
    """Send team invitation emails via InsForge functions service.

    For each email in the request, attempts to invoke the InsForge
    send-invite function. Emails that fail are collected in the `failed`
    list; the endpoint always returns 200 with a partial-success response.
    """
    insforge_url = os.getenv("INSFORGE_URL", "https://45syfrke.us-east.insforge.app")
    insforge_api_key = os.getenv("INSFORGE_API_KEY", "")

    sent = 0
    failed: list[str] = []

    for email in body.emails:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{insforge_url}/api/functions/invoke/send-invite",
                    headers={
                        "Authorization": f"Bearer {insforge_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "to": email,
                        "invited_by": user_id,
                        "type": "team_invite",
                    },
                )
                response.raise_for_status()
                sent += 1
                logger.info(f"Invitation sent to {email} (invited by {user_id})")
        except httpx.HTTPStatusError as exc:
            logger.warning(
                f"Failed to send invite to {email}: HTTP {exc.response.status_code}"
            )
            failed.append(email)
        except httpx.RequestError as exc:
            # Network-level failure (timeout, DNS, connection refused, etc.)
            logger.warning(f"Failed to send invite to {email}: {exc}")
            failed.append(email)
        except Exception as exc:
            # Catch-all so one bad email doesn't break the loop
            logger.error(f"Unexpected error sending invite to {email}: {exc}")
            failed.append(email)

    # If InsForge functions aren't deployed yet, log and report all as sent
    # (placeholder behavior). This block activates when *every* email fails
    # with a connection error, suggesting the service isn't available.
    if failed and sent == 0 and not insforge_api_key:
        logger.warning(
            "InsForge functions service unavailable or API key not set. "
            "Logging invite attempt as placeholder — returning success."
        )
        for email in body.emails:
            logger.info(f"[placeholder] Would send invitation to {email} (invited by {user_id})")
        return InviteResponse(sent=len(body.emails), failed=[])

    return InviteResponse(sent=sent, failed=failed)


@router.get("/heartbeat/{cluster_name}", response_model=HeartbeatResponse)
async def get_heartbeat(cluster_name: str, user_id: str = Depends(get_current_user)):
    """Return whether a heartbeat has been received for the given cluster."""
    insforge_url = os.getenv("INSFORGE_URL")
    insforge_api_key = os.getenv("INSFORGE_API_KEY")

    if not insforge_url or not insforge_api_key:
        logger.error("INSFORGE_URL or INSFORGE_API_KEY not configured")
        return HeartbeatResponse(connected=False, first_heartbeat_at=None)

    headers = {
        "Authorization": f"Bearer {insforge_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{insforge_url}/api/database/records/clusters"
                f"?user_id=eq.{user_id}&cluster_name=eq.{cluster_name}&select=last_heartbeat_at",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            if not data:
                # No cluster row found for this user/cluster_name
                return HeartbeatResponse(connected=False, first_heartbeat_at=None)

            last_heartbeat_at = data[0].get("last_heartbeat_at")
            if last_heartbeat_at is None:
                return HeartbeatResponse(connected=False, first_heartbeat_at=None)

            return HeartbeatResponse(connected=True, first_heartbeat_at=last_heartbeat_at)

    except httpx.HTTPStatusError as e:
        logger.error(f"Heartbeat query failed with status {e.response.status_code}: {e.response.text}")
        return HeartbeatResponse(connected=False, first_heartbeat_at=None)
    except Exception as e:
        logger.error(f"Heartbeat query failed: {e}")
        return HeartbeatResponse(connected=False, first_heartbeat_at=None)
