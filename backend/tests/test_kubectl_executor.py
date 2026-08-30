from unittest.mock import patch, MagicMock
import subprocess
import pytest
from app.kubernetes.executor import KubectlExecutor

def test_kubectl_executor_safe_invocation():
    with patch("subprocess.run") as mock_run:
        mock_result = MagicMock()
        mock_result.stdout = "pod1\npod2"
        mock_run.return_value = mock_result

        output = KubectlExecutor.run("kubectl get pods -A", parse_json=False, context="my-context")

        assert output == "pod1\npod2"
        mock_run.assert_called_once()
        args, kwargs = mock_run.call_args
        assert kwargs.get("shell") is False
        assert args[0] == ["kubectl", "--request-timeout=5s", "--context=my-context", "get", "pods", "-A"]

def test_kubectl_executor_context_command_injection_prevented():
    with patch("subprocess.run") as mock_run:
        mock_result = MagicMock()
        mock_result.stdout = "ok"
        mock_run.return_value = mock_result

        malicious_context = "dev; touch /tmp/pwned"
        KubectlExecutor.run("kubectl get pods", context=malicious_context)

        mock_run.assert_called_once()
        args, kwargs = mock_run.call_args
        assert kwargs.get("shell") is False
        assert args[0] == ["kubectl", "--request-timeout=5s", f"--context={malicious_context}", "get", "pods"]
