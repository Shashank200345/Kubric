import base64
import hashlib
import hmac
import json
import time
from app.main import _user_id_from_jwt

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
