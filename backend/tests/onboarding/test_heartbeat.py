"""Tests for GET /api/v1/onboarding/heartbeat/{cluster_name} endpoint."""

import base64
import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

from app.api.onboarding import router
from fastapi import FastAPI

# Create a minimal test app with only the onboarding router
app = FastAPI()
app.include_router(router)


import hmac
import hashlib

TEST_SECRET = "test-jwt-secret-key"

def _make_jwt(payload: dict, secret: str = TEST_SECRET) -> str:
    """Create a signed JWT with the given payload."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    msg = f"{header}.{body}".encode("utf-8")
    sig_bytes = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode()
    return f"{header}.{body}.{signature}"


@pytest.fixture
def auth_headers(monkeypatch):
    """Return valid Authorization headers with a user_id in the JWT sub claim."""
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    token = _make_jwt({"sub": "user-123-abc"})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_heartbeat_returns_401_without_auth():
    """Without Authorization header, returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/onboarding/heartbeat/my-cluster")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_heartbeat_returns_connected_false_when_env_not_configured(auth_headers):
    """When INSFORGE_URL or INSFORGE_API_KEY is missing, returns connected=False."""
    with patch("app.api.onboarding.os.getenv", return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/onboarding/heartbeat/my-cluster", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["first_heartbeat_at"] is None


@pytest.mark.asyncio
async def test_heartbeat_returns_connected_false_when_cluster_not_found(auth_headers):
    """When no cluster row found for the user, returns connected=False."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []
    mock_resp.raise_for_status = MagicMock()

    async def fake_get(*args, **kwargs):
        return mock_resp

    mock_client_instance = AsyncMock()
    mock_client_instance.get = fake_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.api.onboarding.os.getenv") as mock_getenv:
        mock_getenv.side_effect = lambda key: {
            "INSFORGE_URL": "https://test.insforge.app",
            "INSFORGE_API_KEY": "test-api-key",
            "JWT_SECRET": TEST_SECRET,
        }.get(key)

        with patch("app.api.onboarding.httpx.AsyncClient", return_value=mock_client_instance):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/v1/onboarding/heartbeat/my-cluster", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["first_heartbeat_at"] is None


@pytest.mark.asyncio
async def test_heartbeat_returns_connected_false_when_last_heartbeat_is_null(auth_headers):
    """When cluster exists but last_heartbeat_at is null, returns connected=False."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"last_heartbeat_at": None}]
    mock_resp.raise_for_status = MagicMock()

    async def fake_get(*args, **kwargs):
        return mock_resp

    mock_client_instance = AsyncMock()
    mock_client_instance.get = fake_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.api.onboarding.os.getenv") as mock_getenv:
        mock_getenv.side_effect = lambda key: {
            "INSFORGE_URL": "https://test.insforge.app",
            "INSFORGE_API_KEY": "test-api-key",
            "JWT_SECRET": TEST_SECRET,
        }.get(key)

        with patch("app.api.onboarding.httpx.AsyncClient", return_value=mock_client_instance):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/v1/onboarding/heartbeat/my-cluster", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["first_heartbeat_at"] is None


@pytest.mark.asyncio
async def test_heartbeat_returns_connected_true_when_heartbeat_exists(auth_headers):
    """When cluster exists and last_heartbeat_at is set, returns connected=True with timestamp."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"last_heartbeat_at": "2025-01-15T10:35:22Z"}]
    mock_resp.raise_for_status = MagicMock()

    async def fake_get(*args, **kwargs):
        return mock_resp

    mock_client_instance = AsyncMock()
    mock_client_instance.get = fake_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.api.onboarding.os.getenv") as mock_getenv:
        mock_getenv.side_effect = lambda key: {
            "INSFORGE_URL": "https://test.insforge.app",
            "INSFORGE_API_KEY": "test-api-key",
            "JWT_SECRET": TEST_SECRET,
        }.get(key)

        with patch("app.api.onboarding.httpx.AsyncClient", return_value=mock_client_instance):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/v1/onboarding/heartbeat/prod-cluster", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is True
    assert data["first_heartbeat_at"] == "2025-01-15T10:35:22Z"


@pytest.mark.asyncio
async def test_heartbeat_returns_connected_false_on_http_error(auth_headers):
    """When the InsForge API returns an error, returns connected=False gracefully."""
    from httpx import Response, Request

    mock_response = Response(status_code=500, text="Internal Server Error", request=Request("GET", "http://test"))

    async def fake_get(*args, **kwargs):
        raise __import__("httpx").HTTPStatusError(
            "Server Error", request=mock_response.request, response=mock_response
        )

    mock_client_instance = AsyncMock()
    mock_client_instance.get = fake_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.api.onboarding.os.getenv") as mock_getenv:
        mock_getenv.side_effect = lambda key: {
            "INSFORGE_URL": "https://test.insforge.app",
            "INSFORGE_API_KEY": "test-api-key",
            "JWT_SECRET": TEST_SECRET,
        }.get(key)

        with patch("app.api.onboarding.httpx.AsyncClient", return_value=mock_client_instance):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/v1/onboarding/heartbeat/my-cluster", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["first_heartbeat_at"] is None
