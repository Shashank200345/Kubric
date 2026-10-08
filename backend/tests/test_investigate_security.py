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


def test_investigate_unauthenticated(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    response = client.post(
        "/investigate",
        json={"investigation_id": "inv_123", "cluster_context": "minikube"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_investigate_invalid_jwt(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)

    # Missing signature / wrong secret
    bad_token = make_jwt({"sub": VALID_UUID}, secret="wrong-secret")
    response = client.post(
        "/investigate",
        json={"investigation_id": "inv_123", "cluster_context": "minikube"},
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}

    # Non-UUID sub claim
    non_uuid_token = make_jwt({"sub": "invalid-sub-claim"})
    response = client.post(
        "/investigate",
        json={"investigation_id": "inv_123", "cluster_context": "minikube"},
        headers={"Authorization": f"Bearer {non_uuid_token}"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_investigate_invalid_cluster_context(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_token = make_jwt({"sub": VALID_UUID})

    for invalid_cluster in INVALID_CLUSTER_NAMES:
        response = client.post(
            "/investigate",
            json={"investigation_id": "inv_123", "cluster_context": invalid_cluster},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid cluster context"}


def test_investigate_valid_authenticated_request(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_token = make_jwt({"sub": VALID_UUID})

    mock_diagnosis = {
        "root_cause": "Pod CrashLoopBackOff",
        "explanation": "Memory limit exceeded",
        "suggested_fix": "Increase memory limits",
        "kubectl_command": "kubectl set resources ...",
        "confidence": 95,
    }

    with patch("app.insforge_client.InsForgeClient.create_investigation", new_callable=AsyncMock) as mock_create_inv, \
         patch("app.insforge_client.InsForgeClient.complete_investigation", new_callable=AsyncMock) as mock_complete_inv, \
         patch("app.kubernetes.service.InvestigationService.run_investigation", new_callable=AsyncMock) as mock_run_inv, \
         patch("app.ai.agent.KubernetesAIAgent.analyze", new_callable=AsyncMock) as mock_analyze:

        mock_create_inv.return_value = VALID_UUID
        mock_run_inv.return_value = {
            "pods": {"healthy": False, "problematic_pods": []},
            "logs": {},
            "events": [],
            "deployments": [],
            "network": {},
        }
        mock_analyze.return_value = mock_diagnosis

        response = client.post(
            "/investigate",
            json={"investigation_id": "inv_123", "cluster_context": "my-cluster-1"},
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["investigation_id"] == VALID_UUID
        assert data["diagnosis"] == mock_diagnosis
