"""Pydantic models for the onboarding API."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

# Ordered list of onboarding steps
ONBOARDING_STEPS: list[str] = [
    "welcome",
    "cluster_name",
    "connection_method",
    "web_token",
    "cli",
    "trust_mode",
    "team_invite",
    "awaiting_scan",
    "celebration",
]


class OnboardingStateResponse(BaseModel):
    """Response model for GET /api/v1/onboarding/state."""

    current_step: str
    cluster_name: Optional[str] = None
    connection_method: Optional[Literal["web_token", "cli"]] = None
    trust_mode: str = "approve"
    invited_emails: list[str] = []
    completed_steps: list[str] = []
    step_timestamps: dict[str, str] = {}
    is_complete: bool = False


class StepUpdateRequest(BaseModel):
    """Request model for PATCH /api/v1/onboarding/step."""

    step: str
    data: dict = {}


class ClusterTokenRequest(BaseModel):
    """Request model for POST /api/v1/onboarding/cluster-token."""

    cluster_name: str = Field(
        min_length=3,
        max_length=63,
        pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$",
    )


class ClusterTokenResponse(BaseModel):
    """Response model for POST /api/v1/onboarding/cluster-token."""

    cluster_token: str
    helm_command: str


class HeartbeatResponse(BaseModel):
    """Response model for GET /api/v1/onboarding/heartbeat/{cluster_name}."""

    connected: bool
    first_heartbeat_at: Optional[datetime] = None


class InviteRequest(BaseModel):
    """Request model for POST /api/v1/onboarding/invite."""

    emails: list[EmailStr] = Field(min_length=1, max_length=20)


class InviteResponse(BaseModel):
    """Response model for POST /api/v1/onboarding/invite."""

    sent: int
    failed: list[str] = []
