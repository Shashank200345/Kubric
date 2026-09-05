"""Tests for GET /api/v1/onboarding/state endpoint."""

import base64
import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

import app.api.onboarding as onboarding_module
from app.api.onboarding import router
from fastapi import FastAPI

# Create a minimal test app with only the onboarding router
app = FastAPI()
app.include_router(router)


import hmac
import hashlib

TEST_SECRET = "test-jwt-secret-key"

def _make_jwt(payload: dict, secret: str = TEST_SECRET, alg: str = "HS256", invalid_sig: bool = False) -> str:
    """Create a signed JWT with the given payload."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": alg}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    msg = f"{header}.{body}".encode("utf-8")
    if invalid_sig:
        signature = base64.urlsafe_b64encode(b"invalidsig").rstrip(b"=").decode()
    elif alg == "none":
        signature = ""
    else:
        sig_bytes = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).digest()
        signature = base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode()
    return f"{header}.{body}.{signature}" if alg != "none" else f"{header}.{body}."


TEST_USER_ID = "user-123-abc"


@pytest.fixture
def auth_headers(monkeypatch):
    """Return valid Authorization headers with a properly signed JWT."""
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    token = _make_jwt({"sub": TEST_USER_ID})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_state_returns_401_without_auth():
    """Without Authorization header, returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/onboarding/state")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_get_state_returns_401_with_invalid_token():
    """With an invalid JWT (missing sub claim), returns 401."""
    token = _make_jwt({"name": "no-sub-here"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/onboarding/state", headers=headers)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_state_returns_401_with_forged_signature(monkeypatch):
    """Rejects JWT with an invalid signature."""
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    token = _make_jwt({"sub": TEST_USER_ID}, invalid_sig=True)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/onboarding/state", headers=headers)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_state_returns_401_with_alg_none(monkeypatch):
    """Rejects JWT using 'alg: none'."""
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    token = _make_jwt({"sub": TEST_USER_ID}, alg="none")
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/onboarding/state", headers=headers)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_state_returns_401_with_expired_token(monkeypatch):
    """Rejects expired JWT."""
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    token = _make_jwt({"sub": TEST_USER_ID, "exp": 1000000000})  # past timestamp
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/onboarding/state", headers=headers)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_state_returns_500_when_env_not_configured(auth_headers):
    """When INSFORGE_URL or INSFORGE_API_KEY is missing, returns 500."""
    with patch.object(onboarding_module, "_INSFORGE_URL", ""), \
         patch.object(onboarding_module, "_INSFORGE_API_KEY", ""):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/onboarding/state", headers=auth_headers)

    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_get_state_returns_404_when_no_record(auth_headers):
    """When no onboarding record exists, returns 404."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []
    mock_resp.raise_for_status = MagicMock()

    async def mock_get(*args, **kwargs):
        return mock_resp

    mock_client_instance = AsyncMock()
    mock_client_instance.get = mock_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch.object(onboarding_module, "_INSFORGE_URL", "https://test.insforge.app"), \
         patch.object(onboarding_module, "_INSFORGE_API_KEY", "test-api-key"), \
         patch.object(onboarding_module, "_BASE_URL", "https://test.insforge.app/api/database/records"), \
         patch("app.api.onboarding.httpx.AsyncClient", return_value=mock_client_instance):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/onboarding/state", headers=auth_headers)

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Onboarding state not found"


@pytest.mark.asyncio
async def test_get_state_returns_onboarding_record(auth_headers):
    """When a record exists, returns 200 with OnboardingStateResponse fields."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [
        {
            "id": "record-1",
            "user_id": TEST_USER_ID,
            "current_step": "cluster_name",
            "cluster_name": None,
            "connection_method": None,
            "trust_mode": "approve",
            "invited_emails": [],
            "completed_steps": ["welcome"],
            "step_timestamps": {"welcome": "2025-01-15T10:30:00Z"},
            "is_complete": False,
        }
    ]
    mock_resp.raise_for_status = MagicMock()

    async def mock_get(*args, **kwargs):
        return mock_resp

    mock_client_instance = AsyncMock()
    mock_client_instance.get = mock_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch.object(onboarding_module, "_INSFORGE_URL", "https://test.insforge.app"), \
         patch.object(onboarding_module, "_INSFORGE_API_KEY", "test-api-key"), \
         patch.object(onboarding_module, "_BASE_URL", "https://test.insforge.app/api/database/records"), \
         patch("app.api.onboarding.httpx.AsyncClient", return_value=mock_client_instance):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/onboarding/state", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["current_step"] == "cluster_name"
    assert data["cluster_name"] is None
    assert data["connection_method"] is None
    assert data["trust_mode"] == "approve"
    assert data["invited_emails"] == []
    assert data["completed_steps"] == ["welcome"]
    assert data["step_timestamps"] == {"welcome": "2025-01-15T10:30:00Z"}
    assert data["is_complete"] is False
