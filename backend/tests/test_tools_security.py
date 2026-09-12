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
