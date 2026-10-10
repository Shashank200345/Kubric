import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_cli_get_status_invalid_cluster_name():
    headers = {"Authorization": "Bearer test-token"}
    # Pass an invalid cluster name containing flag characters or spaces
    response = client.get("/v1/status?cluster=--invalid-flag", headers=headers)
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid cluster name"}

def test_cli_get_status_valid_cluster_name():
    headers = {"Authorization": "Bearer test-token"}
    # Pass a valid cluster name
    response = client.get("/v1/status?cluster=prod-cluster_01.k8s", headers=headers)
    assert response.status_code == 200


def test_cli_connect_cluster_invalid_name():
    headers = {"Authorization": "Bearer test-token"}
    response = client.post("/v1/clusters/connect", headers=headers, json={"cluster_name": "--invalid-flag"})
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid cluster name"}


def test_cli_connect_cluster_valid_name():
    headers = {"Authorization": "Bearer test-token"}
    response = client.post("/v1/clusters/connect", headers=headers, json={"cluster_name": "prod-cluster-01"})
    assert response.status_code == 200
    assert "helm_values" in response.json()


def test_investigate_invalid_cluster_context(monkeypatch):
    from tests.test_jwt_verification import make_jwt, SECRET
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    monkeypatch.setenv("JWT_SECRET", SECRET)
    valid_token = make_jwt({"sub": valid_uuid})
    response = client.post(
        "/investigate",
        json={"investigation_id": "inv_123", "cluster_context": "--invalid-flag"},
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid cluster context"}
