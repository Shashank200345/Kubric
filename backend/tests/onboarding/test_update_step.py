"""Unit tests for PATCH /api/v1/onboarding/step endpoint."""

import base64
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.onboarding import router
from app.models.onboarding import ONBOARDING_STEPS

app = FastAPI()
app.include_router(router)
client = TestClient(app)

TEST_SECRET = "test-jwt-secret-key"


def _make_jwt(sub: str = "12345678-1234-5678-1234-567812345678", secret: str = TEST_SECRET) -> str:
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
    return httpx.Response(
        status_code=status_code,
        json=json_data or [],
        request=httpx.Request("GET", "http://test"),
    )


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
            "user_id": "12345678-1234-5678-1234-567812345678",
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

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": "welcome", "data": {}},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["current_step"] == "cluster_name"
        assert body["completed_steps"] == ["welcome"]
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
        mock_instance.get = AsyncMock(return_value=_mock_response(200, []))
        mock_instance.post = AsyncMock(return_value=_mock_response(201, [new_record]))
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
        mock_instance.post.assert_called_once()

    @pytest.mark.parametrize(
        "step,data,expected_key,expected_val",
        [
            ("cluster_name", {"cluster_name": "prod-eks"}, "cluster_name", "prod-eks"),
            ("connection_method", {"connection_method": "cli"}, "connection_method", "cli"),
            ("trust_mode", {"trust_mode": "auto"}, "trust_mode", "auto"),
            ("team_invite", {"invited_emails": ["a@b.com", "c@d.com"]}, "invited_emails", ["a@b.com", "c@d.com"]),
        ],
    )
    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_step_specific_data_success(self, mock_client_cls, step, data, expected_key, expected_val):
        """Completing onboarding steps persists step-specific payload fields."""
        existing_record = {
            "user_id": "user-123",
            "current_step": step,
            "completed_steps": ["welcome"],
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
            json={"step": step, "data": data},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 200
        patch_call = mock_instance.patch.call_args
        patch_json = patch_call.kwargs.get("json") or patch_call[1].get("json")
        assert patch_json[expected_key] == expected_val

    @pytest.mark.parametrize(
        "step,data,expected_detail",
        [
            ("cluster_name", {"cluster_name": "cluster,user_id=neq.0"}, "Invalid cluster name"),
            ("connection_method", {"connection_method": "invalid_method"}, "Invalid connection method"),
            ("trust_mode", {"trust_mode": "invalid_mode"}, "Invalid trust mode"),
            ("team_invite", {"invited_emails": "not-a-list@example.com"}, "Invalid invited emails list"),
            ("team_invite", {"invited_emails": ["valid@example.com", "not-an-email"]}, "Invalid email format"),
        ],
    )
    @patch("app.api.onboarding.httpx.AsyncClient")
    def test_step_specific_data_validation_failures(self, mock_client_cls, step, data, expected_detail):
        """Invalid step-specific data payloads return 400 Bad Request."""
        existing_record = {
            "user_id": "user-123",
            "current_step": step,
            "completed_steps": ["welcome"],
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

        resp = client.patch(
            "/api/v1/onboarding/step",
            json={"step": step, "data": data},
            headers=AUTH_HEADER,
        )
        assert resp.status_code == 400
        assert expected_detail in resp.json()["detail"]
