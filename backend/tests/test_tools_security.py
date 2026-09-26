import pytest
from app.ai.tools import LiveKubectlTools

@pytest.mark.asyncio
async def test_live_kubectl_tools_invalid_namespace_dash():
    tools = LiveKubectlTools()
    res = await tools.list_pods(namespace="--all")
    assert "error" in res
    assert "cannot start with '-'" in res["error"]

@pytest.mark.asyncio
async def test_live_kubectl_tools_invalid_namespace_chars():
    tools = LiveKubectlTools()
    res = await tools.list_pods(namespace="default; cat /etc/passwd")
    assert "error" in res
    assert "contains invalid characters" in res["error"]

@pytest.mark.asyncio
async def test_live_kubectl_tools_invalid_pod_name():
    tools = LiveKubectlTools()
    res = await tools.describe_pod(namespace="default", name="--help")
    assert "error" in res
    assert "cannot start with '-'" in res["error"]

@pytest.mark.asyncio
async def test_live_kubectl_tools_logs_tail_lines_validation(monkeypatch):
    tools = LiveKubectlTools()
    called_cmd = None

    def fake_run(command, parse_json=False, context=None):
        nonlocal called_cmd
        called_cmd = command
        return "fake logs"

    monkeypatch.setattr("app.kubernetes.executor.KubectlExecutor.run", fake_run)

    # Negative tail_lines should fall back to default (60)
    res = await tools.get_pod_logs(namespace="default", name="my-pod", tail_lines=-10)
    assert res == {"logs": "fake logs"}
    assert "--tail=60" in called_cmd

    # Excessive tail_lines should fall back to default (60)
    res = await tools.get_pod_logs(namespace="default", name="my-pod", tail_lines=10000)
    assert "--tail=60" in called_cmd


def test_generate_safe_kubectl_command_validation():
    from app.ai.agent import KubernetesAIAgent

    agent = KubernetesAIAgent()

    # Valid restart pod
    cmd = agent._generate_safe_kubectl_command("restart_pod", {"pod_name": "my-pod-123", "namespace": "default"})
    assert cmd == "kubectl delete pod my-pod-123 -n default"

    # Invalid pod name (leading dash / option injection)
    cmd = agent._generate_safe_kubectl_command("restart_pod", {"pod_name": "--all", "namespace": "default"})
    assert cmd == ""

    # Invalid namespace (shell injection characters)
    cmd = agent._generate_safe_kubectl_command("restart_pod", {"pod_name": "my-pod", "namespace": "default; rm -rf /"})
    assert cmd == ""

    # Valid scale deployment
    cmd = agent._generate_safe_kubectl_command("scale_deployment", {"deployment_name": "web", "replicas": 3, "namespace": "prod"})
    assert cmd == "kubectl scale deployment/web --replicas=3 -n prod"

    # Invalid replicas (non-digit)
    cmd = agent._generate_safe_kubectl_command("scale_deployment", {"deployment_name": "web", "replicas": "3; cat /etc/passwd", "namespace": "prod"})
    assert cmd == ""

    # Valid env update
    cmd = agent._generate_safe_kubectl_command("update_environment_variable", {"deployment_name": "web", "env_name": "API_KEY", "env_value": "secret123", "namespace": "default"})
    assert cmd == "kubectl set env deployment/web API_KEY=secret123 -n default"

    # Invalid env value (command injection characters)
    cmd = agent._generate_safe_kubectl_command("update_environment_variable", {"deployment_name": "web", "env_name": "API_KEY", "env_value": "foo; echo injected", "namespace": "default"})
    assert cmd == ""

    # Invalid env name
    cmd = agent._generate_safe_kubectl_command("update_environment_variable", {"deployment_name": "web", "env_name": "--bad-var", "env_value": "val", "namespace": "default"})
    assert cmd == ""
