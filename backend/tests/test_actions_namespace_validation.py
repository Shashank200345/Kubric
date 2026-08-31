import pytest
import base64
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_mock_jwt(user_id="user_123"):
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user_id}).encode()).decode().rstrip("=")
    signature = "signature"
    return f"{header}.{payload}.{signature}"

@pytest.mark.parametrize("namespace", ["kube-system", "kube-public", "kube-node-lease", "kubric-system"])
def test_create_action_blocked_namespaces(namespace):
    jwt = create_mock_jwt()
    response = client.post(
        "/api/v1/actions",
        headers={"Authorization": f"Bearer {jwt}"},
        json={
            "investigation_id": "inv_123",
            "action_type": "restart_pod",
            "params": {
                "namespace": namespace,
                "pod_name": "test-pod"
            }
        }
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Cannot execute actions in system namespaces"

def test_create_action_allowed_namespace():
    jwt = create_mock_jwt()
    with patch("app.main.InsForgeClient") as MockInsForgeClient:
        mock_client_instance = AsyncMock()
        mock_client_instance.get_investigation_details.return_value = {
            "user_id": "user_123",
            "cluster_context": "test-cluster"
        }
        mock_client_instance.create_action.return_value = {
            "id": "action_123",
            "status": "pending"
        }
        mock_client_instance.update_action_result.return_value = True
        MockInsForgeClient.return_value = mock_client_instance

        with patch("app.main._execute_action_locally") as mock_exec:
            mock_exec.return_value = ("success", "pod deleted")

            response = client.post(
                "/api/v1/actions",
                headers={"Authorization": f"Bearer {jwt}"},
                json={
                    "investigation_id": "inv_123",
                    "action_type": "restart_pod",
                    "params": {
                        "namespace": "default",
                        "pod_name": "test-pod"
                    }
                }
            )
            assert response.status_code == 200
            assert response.json()["id"] == "action_123"
