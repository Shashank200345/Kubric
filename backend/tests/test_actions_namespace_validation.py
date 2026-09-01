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


def test_build_action_argv_flag_injection_prevention():
    from app.main import _build_action_argv

    # Flag injection attempts via pod_name or env_name
    assert _build_action_argv("restart_pod", {"namespace": "default", "pod_name": "--all"}, None) is None
    assert _build_action_argv("scale_deployment", {"namespace": "default", "deployment_name": "--selector=app", "replicas": 2}, None) is None
    assert _build_action_argv("update_environment_variable", {"namespace": "default", "deployment_name": "web", "env_name": "--all", "env_value": "x"}, None) is None
    assert _build_action_argv("update_environment_variable", {"namespace": "default", "deployment_name": "web", "env_name": "INVALID-NAME", "env_value": "x"}, None) is None


def test_build_action_argv_container_scoped_env():
    from app.main import _build_action_argv

    argv_with_container = _build_action_argv(
        "update_environment_variable",
        {"namespace": "default", "deployment_name": "web", "container_name": "app", "env_name": "API_KEY", "env_value": "secret"},
        None
    )
    assert argv_with_container == ["kubectl", "-n", "default", "set", "env", "deployment/web", "-c=app", "API_KEY=secret"]

    argv_without_container = _build_action_argv(
        "update_environment_variable",
        {"namespace": "default", "deployment_name": "web", "env_name": "API_KEY", "env_value": "secret"},
        None
    )
    assert argv_without_container == ["kubectl", "-n", "default", "set", "env", "deployment/web", "API_KEY=secret"]


def test_create_action_invalid_env_name_pattern():
    jwt = create_mock_jwt()
    response = client.post(
        "/api/v1/actions",
        headers={"Authorization": f"Bearer {jwt}"},
        json={
            "investigation_id": "inv_123",
            "action_type": "update_environment_variable",
            "params": {
                "namespace": "default",
                "deployment_name": "web",
                "env_name": "--all",
                "env_value": "val"
            }
        }
    )
    assert response.status_code == 422
