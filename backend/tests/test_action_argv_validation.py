import pytest
from fastapi.testclient import TestClient
from app.main import app, _build_action_argv
from tests.test_jwt_verification import make_jwt, SECRET

client = TestClient(app)

VALID_UUID = "12345678-1234-5678-1234-567812345678"

INVALID_RESOURCE_NAMES = [
    "--flag-injection",
    "-n",
    "name with spaces",
    "name;injection",
    "name|injection",
    "name&injection",
    "name'OR'1'='1",
    "../path/traversal",
    "invalid_underscore",
    "invalid*character",
]


def test_build_action_argv_valid_inputs():
    # restart_pod
    argv = _build_action_argv("restart_pod", {"namespace": "default", "pod_name": "my-pod-1"}, None)
    assert argv == ["kubectl", "-n", "default", "delete", "pod", "my-pod-1"]

    # rollback_deployment
    argv = _build_action_argv(
        "rollback_deployment",
        {"namespace": "prod", "deployment_name": "web-app", "target_revision": 2},
        "cluster-a",
    )
    assert argv == ["kubectl", "--context=cluster-a", "-n", "prod", "rollout", "undo", "deployment/web-app", "--to-revision=2"]

    # scale_deployment
    argv = _build_action_argv(
        "scale_deployment",
        {"namespace": "staging", "deployment_name": "api-server", "replicas": 3},
        None,
    )
    assert argv == ["kubectl", "-n", "staging", "scale", "deployment/api-server", "--replicas=3"]


def test_build_action_argv_invalid_resource_names():
    for invalid in INVALID_RESOURCE_NAMES:
        # Invalid namespace
        assert _build_action_argv("restart_pod", {"namespace": invalid, "pod_name": "valid-pod"}, None) is None

        # Invalid pod_name
        assert _build_action_argv("restart_pod", {"namespace": "default", "pod_name": invalid}, None) is None

        # Invalid deployment_name
        assert _build_action_argv("rollback_deployment", {"namespace": "default", "deployment_name": invalid}, None) is None

        # Invalid container_name
        assert _build_action_argv(
            "update_resource_limits",
            {"namespace": "default", "deployment_name": "valid-dep", "container_name": invalid, "memory_limit": "512Mi"},
            None,
        ) is None


def test_metrics_history_auth_in_agent_mode(monkeypatch):
    monkeypatch.setenv("KUBRIC_DATA_SOURCE", "agent")
    monkeypatch.setenv("JWT_SECRET", SECRET)

    # 1. Unauthenticated request in agent mode should return 401
    resp = client.get("/metrics/history")
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Authentication required. Please sign in."}

    # 2. Authenticated request in agent mode should return 200
    token = make_jwt({"sub": VALID_UUID})
    resp = client.get("/metrics/history", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "samples" in resp.json()
