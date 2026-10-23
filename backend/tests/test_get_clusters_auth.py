import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from tests.test_jwt_verification import make_jwt, SECRET

client = TestClient(app)

def test_get_clusters_unauthenticated():
    response = client.get("/clusters")
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}

def test_get_clusters_invalid_jwt():
    response = client.get("/clusters", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}

def test_get_clusters_authenticated_local_mode(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.setenv("KUBRIC_DATA_SOURCE", "local")
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    token = make_jwt({"sub": valid_uuid})

    with patch("app.main.KubectlExecutor.run") as mock_run:
        mock_run.return_value = "cluster-1\ncluster-2"
        response = client.get("/clusters", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json() == {"clusters": ["cluster-1", "cluster-2"]}

def test_get_clusters_authenticated_agent_mode(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.setenv("KUBRIC_DATA_SOURCE", "agent")
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    token = make_jwt({"sub": valid_uuid})

    with patch("app.main.InsForgeClient") as MockInsForgeClient:
        mock_instance = AsyncMock()
        MockInsForgeClient.return_value = mock_instance
        mock_instance.list_state_clusters.return_value = ["agent-cluster-1"]

        response = client.get("/clusters", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json() == {"clusters": ["agent-cluster-1"]}
        mock_instance.list_state_clusters.assert_called_once_with(valid_uuid)
