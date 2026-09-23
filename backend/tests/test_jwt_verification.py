import base64
import hashlib
import hmac
import json
import pytest
import time
from fastapi import HTTPException
from app.main import _user_id_from_jwt
from app.api.onboarding import get_current_user

SECRET = "test-secret-key-123"

def make_jwt(payload: dict, alg: str = "HS256", secret: str = SECRET) -> str:
    header = {"alg": alg, "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode("utf-8")).rstrip(b"=").decode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).rstrip(b"=").decode("utf-8")

    if alg == "none":
        return f"{header_b64}.{payload_b64}."

    msg = f"{header_b64}.{payload_b64}".encode("utf-8")
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).digest()
    ).rstrip(b"=").decode("utf-8")

    return f"{header_b64}.{payload_b64}.{sig}"

def test_user_id_from_jwt_valid(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    payload = {"sub": valid_uuid, "exp": int(time.time()) + 3600}
    token = make_jwt(payload)

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res == valid_uuid

def test_user_id_from_jwt_non_uuid_sub(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    payload = {"sub": "user_12345,user_id=neq.0", "exp": int(time.time()) + 3600}
    token = make_jwt(payload)

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res is None

def test_user_id_from_jwt_forged_signature(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    payload = {"sub": valid_uuid, "exp": int(time.time()) + 3600}
    token = make_jwt(payload, secret="wrong-secret")

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res is None

def test_user_id_from_jwt_none_alg(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    payload = {"sub": "user_12345", "exp": int(time.time()) + 3600}
    token = make_jwt(payload, alg="none")

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res is None

def test_user_id_from_jwt_expired(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    payload = {"sub": "user_12345", "exp": int(time.time()) - 100}
    token = make_jwt(payload)

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res is None

def test_user_id_from_jwt_no_secret_configured(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("INSFORGE_API_KEY", raising=False)
    payload = {"sub": "user_12345", "exp": int(time.time()) + 3600}
    token = make_jwt(payload)

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res is None

def test_user_id_from_jwt_malformed():
    assert _user_id_from_jwt(None) is None
    assert _user_id_from_jwt("InvalidHeader") is None
    assert _user_id_from_jwt("Bearer bad.token") is None


@pytest.mark.asyncio
async def test_get_current_user_invalid_sub_uuid(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    payload = {"sub": "user_123,user_id=neq.0", "exp": int(time.time()) + 3600}
    token = make_jwt(payload)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_valid_sub_uuid(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    payload = {"sub": valid_uuid, "exp": int(time.time()) + 3600}
    token = make_jwt(payload)

    res = await get_current_user(authorization=f"Bearer {token}")
    assert res == valid_uuid


def test_investigation_progress_authentication_and_scoping(monkeypatch):
    from unittest.mock import patch, AsyncMock
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.setenv("INSFORGE_URL", "https://mock.insforge.app")
    monkeypatch.setenv("INSFORGE_API_KEY", "mock-key")

    user_a_uuid = "11111111-1111-1111-1111-111111111111"
    user_b_uuid = "22222222-2222-2222-2222-222222222222"
    inv_id = "33333333-3333-3333-3333-333333333333"

    token_user_a = make_jwt({"sub": user_a_uuid, "exp": int(time.time()) + 3600})
    token_user_b = make_jwt({"sub": user_b_uuid, "exp": int(time.time()) + 3600})

    # 1. Unauthenticated request -> 401
    resp_unauth = client.get(f"/investigate/{inv_id}/progress")
    assert resp_unauth.status_code == 401

    # 2. Authenticated as User B, but investigation belongs to User A -> empty progress ({ "progress": [] })
    with patch("app.main.InsForgeClient") as MockInsForgeClient:
        mock_insforge = AsyncMock()
        mock_insforge.url = "https://mock.insforge.app"
        mock_insforge.base_url = "https://mock.insforge.app/api/database/records"
        mock_insforge.headers = {"Authorization": "Bearer mock-key"}
        mock_insforge.get_investigation_details.return_value = {"user_id": user_a_uuid, "cluster_context": "default"}
        MockInsForgeClient.return_value = mock_insforge

        resp_user_b = client.get(
            f"/investigate/{inv_id}/progress",
            headers={"Authorization": f"Bearer {token_user_b}"}
        )
        assert resp_user_b.status_code == 200
        assert resp_user_b.json() == {"progress": []}

    # 3. Authenticated as User A (owner of investigation) -> returns progress
    with patch("app.main.InsForgeClient") as MockInsForgeClient, patch("httpx.AsyncClient.get") as mock_http_get:
        mock_insforge = AsyncMock()
        mock_insforge.url = "https://mock.insforge.app"
        mock_insforge.base_url = "https://mock.insforge.app/api/database/records"
        mock_insforge.headers = {"Authorization": "Bearer mock-key"}
        mock_insforge.get_investigation_details.return_value = {"user_id": user_a_uuid, "cluster_context": "default"}
        MockInsForgeClient.return_value = mock_insforge

        from unittest.mock import MagicMock
        mock_http_resp = MagicMock()
        mock_http_resp.status_code = 200
        mock_http_resp.raise_for_status.return_value = None
        mock_http_resp.json.return_value = [{"step": "AI Reasoning", "status": "completed"}]
        mock_http_get.return_value = mock_http_resp

        resp_user_a = client.get(
            f"/investigate/{inv_id}/progress",
            headers={"Authorization": f"Bearer {token_user_a}"}
        )
        assert resp_user_a.status_code == 200
        assert resp_user_a.json() == {"progress": [{"step": "AI Reasoning", "status": "completed"}]}
