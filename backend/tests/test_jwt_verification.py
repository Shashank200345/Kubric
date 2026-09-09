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
    payload = {"sub": "user_12345", "exp": int(time.time()) + 3600}
    token = make_jwt(payload)

    res = _user_id_from_jwt(f"Bearer {token}")
    assert res == "user_12345"

def test_user_id_from_jwt_forged_signature(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    payload = {"sub": "user_12345", "exp": int(time.time()) + 3600}
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
