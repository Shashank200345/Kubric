"""Unit tests for POST /api/v1/onboarding/invite endpoint."""

import base64
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.api.onboarding import router


def _make_jwt(sub: str = "user-123") -> str:
    """Create a minimal JWT-shaped token for testing auth extraction."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).rstrip(b"=").decode()
    signature = base64.urlsafe_b64encode(b"fake-sig").rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


@pytest.fixture
def app():
    """Create a FastAPI app with the onboarding router for testing."""
    test_app = FastAPI()
    test_app.include_router(router)
    return test_app


@pytest.fixture
def client(app):
    """TestClient instance."""
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Valid authorization headers."""
    return {"Authorization": f"Bearer {_make_jwt()}"}


class TestInviteEndpoint:
    """Tests for the POST /api/v1/onboarding/invite endpoint."""

    def test_returns_401_without_auth(self, client):
        """Requests without auth should be rejected."""
        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": ["alice@example.com"]},
        )
        assert resp.status_code == 401

    def test_returns_422_with_empty_email_list(self, client, auth_headers):
        """An empty emails list should fail Pydantic validation (min_length=1)."""
        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": []},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_returns_422_with_too_many_emails(self, client, auth_headers):
        """More than 20 emails should fail Pydantic validation (max_length=20)."""
        emails = [f"user{i}@example.com" for i in range(21)]
        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": emails},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_returns_422_with_invalid_email(self, client, auth_headers):
        """Invalid email format should fail Pydantic validation."""
        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": ["not-an-email"]},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_successful_invite(self, mock_async_client_cls, client, auth_headers):
        """When InsForge returns 200 for each email, sent count should match."""
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=None)
        mock_async_client_cls.return_value = mock_client_instance

        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": ["alice@example.com", "bob@example.com"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sent"] == 2
        assert data["failed"] == []

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_partial_failure(self, mock_async_client_cls, client, auth_headers):
        """When some emails fail, they should appear in the failed list."""
        success_response = AsyncMock()
        success_response.status_code = 200
        success_response.raise_for_status = lambda: None

        fail_response = AsyncMock()
        fail_response.status_code = 500
        fail_response.text = "Internal Server Error"

        def raise_for_status():
            raise httpx.HTTPStatusError(
                "Server Error",
                request=httpx.Request("POST", "http://test"),
                response=fail_response,
            )

        fail_response.raise_for_status = raise_for_status

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return success_response
            return fail_response

        mock_client_instance = AsyncMock()
        mock_client_instance.post = mock_post
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=None)
        mock_async_client_cls.return_value = mock_client_instance

        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": ["alice@example.com", "bob@example.com"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sent"] == 1
        assert data["failed"] == ["bob@example.com"]

    @patch.dict("os.environ", {"INSFORGE_API_KEY": "", "INSFORGE_URL": "https://fake.insforge.app"})
    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_placeholder_when_no_api_key(self, mock_async_client_cls, client, auth_headers):
        """When INSFORGE_API_KEY is empty and all emails fail, fallback to placeholder success."""
        # Simulate connection refused for all emails
        async def mock_post(*args, **kwargs):
            raise httpx.ConnectError("Connection refused")

        mock_client_instance = AsyncMock()
        mock_client_instance.post = mock_post
        mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
        mock_client_instance.__aexit__ = AsyncMock(return_value=None)
        mock_async_client_cls.return_value = mock_client_instance

        resp = client.post(
            "/api/v1/onboarding/invite",
            json={"emails": ["alice@example.com"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        # Placeholder: reports all as sent when API key is unset
        assert data["sent"] == 1
        assert data["failed"] == []
