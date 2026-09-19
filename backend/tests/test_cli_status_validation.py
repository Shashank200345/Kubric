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
