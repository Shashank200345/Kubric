import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from tests.test_jwt_verification import make_jwt, SECRET

client = TestClient(app)

VALID_UUID = "12345678-1234-5678-1234-567812345678"

INVALID_CLUSTER_NAMES = [
    "--all",
    "-c",
    "cluster1,id=neq.0",
    "cluster1; drop table users;",
    "cluster1&user_id=eq.123",
    "' OR '1'='1",
]


def test_ask_unauthenticated(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    response = client.post("/ask", json={"message": "What is wrong with my cluster?"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_ask_invalid_jwt(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)

    # Missing signature / wrong secret
    bad_token = make_jwt({"sub": VALID_UUID}, secret="wrong-secret")
    response = client.post(
        "/ask",
        json={"message": "What is wrong with my cluster?"},
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}

    # Non-UUID sub claim
    non_uuid_token = make_jwt({"sub": "invalid-sub-claim"})
    response = client.post(
        "/ask",
        json={"message": "What is wrong with my cluster?"},
        headers={"Authorization": f"Bearer {non_uuid_token}"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_ask_invalid_cluster_context(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_token = make_jwt({"sub": VALID_UUID})

    for invalid_cluster in INVALID_CLUSTER_NAMES:
        response = client.post(
            "/ask",
            json={"message": "Help", "cluster_context": invalid_cluster},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid cluster context"}


def test_ask_valid_authenticated_request(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_token = make_jwt({"sub": VALID_UUID})

    with patch("app.ai.llm.OpenRouterClient.call_llm", new_callable=AsyncMock) as mock_llm, \
         patch("app.kubernetes.executor.KubectlExecutor.run") as mock_kubectl:
        mock_kubectl.return_value = '{"items": []}'
        mock_llm.return_value = '{"reply": "Your cluster is healthy."}'

        response = client.post(
            "/ask",
            json={"message": "Status check", "cluster_context": "my-cluster-1"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert response.status_code == 200
        assert response.json() == {"reply": "Your cluster is healthy."}
