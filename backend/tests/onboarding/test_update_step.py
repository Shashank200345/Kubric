"""Unit tests for PATCH /api/v1/onboarding/step endpoint."""

import base64
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.onboarding import router
from app.models.onboarding import ONBOARDING_STEPS

# Minimal FastAPI app for testing
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)
client = TestClient(app)


import hmac
import hashlib

TEST_SECRET = "test-jwt-secret-key"

def _make_jwt(sub: str = "user-123", secret: str = TEST_SECRET) -> str:
    """Create a signed JWT token for testing."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).rstrip(b"=").decode()
    msg = f"{header}.{payload}".encode("utf-8")
    sig_bytes = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)


AUTH_HEADER = {"Authorization": f"Bearer {_make_jwt()}"}


def _mock_response(status_code: int = 200, json_data=None):
    """Create a mock httpx.Response."""
    resp = httpx.Response(
        status_code=status_code,
        json=json_data or [],
        request=httpx.Request("GET", "http://test"),
    )
    return resp


class TestUpdateOnboardingStep:
    """Tests for the PATCH /step endpoint."""

    def test_invalid_step_returns_422(self):
        """Submitting a step name not in ONBOARDING_STEPS returns 422."""
        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "invalid_step_name", "data": {}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 422
        assert "Invalid step" in resp.json()["detail"]

    def test_missing_auth_returns_401(self):
        """Request without Authorization header returns 401."""
        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "welcome", "data": {}},
        )
        assert resp.status_code == 401

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_idempotent_already_completed_step(self, mock_client_cls):
        """Re-completing an already-completed step returns current state unchanged."""
        existing_record = {
            "user_id": "user-123",
            "current_step": "cluster_name",
            "completed_steps": ["welcome"],
            "step_timestamps": {"welcome": "2025-01-15T10:30:00+00:00"},
            "cluster_name": None,
            "connection_method": None,
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # GET returns existing record with "welcome" already completed
        mock_instance.get = AsyncMock(return_value=_mock_response(200, [existing_record]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "welcome", "data": {}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["current_step"] == "cluster_name"
        assert body["completed_steps"] == ["welcome"]
        # PATCH should NOT have been called since it's a no-op
        mock_instance.patch.assert_not_called()

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_complete_step_advances_to_next(self, mock_client_cls):
        """Completing a step advances current_step to the next in order."""
        existing_record = {
            "user_id": "user-123",
            "current_step": "welcome",
            "completed_steps": [],
            "step_timestamps": {},
            "cluster_name": None,
            "connection_method": None,
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_instance.get = AsyncMock(return_value=_mock_response(200, [existing_record]))
        mock_instance.patch = AsyncMock(return_value=_mock_response(200, [{}]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "welcome", "data": {}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["current_step"] == "cluster_name"
        assert "welcome" in body["completed_steps"]

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_step_specific_data_cluster_name(self, mock_client_cls):
        """Completing the cluster_name step persists the cluster_name from data."""
        existing_record = {
            "user_id": "user-123",
            "current_step": "cluster_name",
            "completed_steps": ["welcome"],
            "step_timestamps": {"welcome": "2025-01-15T10:30:00+00:00"},
            "cluster_name": None,
            "connection_method": None,
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_instance.get = AsyncMock(return_value=_mock_response(200, [existing_record]))
        mock_instance.patch = AsyncMock(return_value=_mock_response(200, [{}]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "cluster_name", "data": {"cluster_name": "prod-eks"}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["current_step"] == "connection_method"
        assert "cluster_name" in body["completed_steps"]

        # Verify the PATCH payload included cluster_name
        patch_call = mock_instance.patch.call_args
        patch_json = patch_call.kwargs.get("json") or patch_call[1].get("json")
        assert patch_json["cluster_name"] == "prod-eks"

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_creates_record_if_none_exists(self, mock_client_cls):
        """If no onboarding record exists, one is created before processing."""
        new_record = {
            "user_id": "user-123",
            "current_step": "welcome",
            "completed_steps": [],
            "step_timestamps": {},
            "cluster_name": None,
            "connection_method": None,
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        # GET returns empty list (no record)
        mock_instance.get = AsyncMock(return_value=_mock_response(200, []))
        # POST creates the record
        mock_instance.post = AsyncMock(return_value=_mock_response(201, [new_record]))
        # PATCH updates it
        mock_instance.patch = AsyncMock(return_value=_mock_response(200, [{}]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "welcome", "data": {}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["current_step"] == "cluster_name"
        assert "welcome" in body["completed_steps"]
        # Verify POST was called to create the record
        mock_instance.post.assert_called_once()

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_step_specific_data_connection_method(self, mock_client_cls):
        """Completing connection_method step persists the method from data."""
        existing_record = {
            "user_id": "user-123",
            "current_step": "connection_method",
            "completed_steps": ["welcome", "cluster_name"],
            "step_timestamps": {},
            "cluster_name": "my-cluster",
            "connection_method": None,
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_instance.get = AsyncMock(return_value=_mock_response(200, [existing_record]))
        mock_instance.patch = AsyncMock(return_value=_mock_response(200, [{}]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "connection_method", "data": {"connection_method": "cli"}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        patch_call = mock_instance.patch.call_args
        patch_json = patch_call.kwargs.get("json") or patch_call[1].get("json")
        assert patch_json["connection_method"] == "cli"

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_step_specific_data_trust_mode(self, mock_client_cls):
        """Completing trust_mode step persists the mode from data."""
        existing_record = {
            "user_id": "user-123",
            "current_step": "trust_mode",
            "completed_steps": ["welcome", "cluster_name", "connection_method", "web_token", "cli"],
            "step_timestamps": {},
            "cluster_name": "my-cluster",
            "connection_method": "web_token",
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_instance.get = AsyncMock(return_value=_mock_response(200, [existing_record]))
        mock_instance.patch = AsyncMock(return_value=_mock_response(200, [{}]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "trust_mode", "data": {"trust_mode": "auto"}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        patch_call = mock_instance.patch.call_args
        patch_json = patch_call.kwargs.get("json") or patch_call[1].get("json")
        assert patch_json["trust_mode"] == "auto"

    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_step_specific_data_team_invite(self, mock_client_cls):
        """Completing team_invite step persists the invited_emails from data."""
        existing_record = {
            "user_id": "user-123",
            "current_step": "team_invite",
            "completed_steps": ["welcome", "cluster_name", "connection_method", "web_token", "cli", "trust_mode"],
            "step_timestamps": {},
            "cluster_name": "my-cluster",
            "connection_method": "web_token",
            "trust_mode": "approve",
            "invited_emails": [],
            "is_complete": False,
        }

        mock_instance = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_instance.get = AsyncMock(return_value=_mock_response(200, [existing_record]))
        mock_instance.patch = AsyncMock(return_value=_mock_response(200, [{}]))

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "team_invite", "data": {"invited_emails": ["a@b.com", "c@d.com"]}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        patch_call = mock_instance.patch.call_args
        patch_json = patch_call.kwargs.get("json") or patch_call[1].get("json")
        assert patch_json["invited_emails"] == ["a@b.com", "c@d.com"]
