from unittest.mock import patch
from app.kubernetes.inspectors.logs import LogsCollector

def test_logs_collector_skips_invalid_pod_and_namespace_flags():
    collector = LogsCollector()
    problematic_pods = [
        {"name": "--all", "namespace": "default"},
        {"name": "valid-pod", "namespace": "--all"},
        {"name": "valid-pod; rm -rf /", "namespace": "default"},
        {"name": "valid-pod", "namespace": "default"},
    ]

    with patch("app.kubernetes.executor.KubectlExecutor.run") as mock_run:
        mock_run.return_value = "Pod log line 1\nPod log line 2"

        logs = collector.collect(problematic_pods)

        # Only the 4th pod (valid-pod in default) should be collected
        assert len(logs) == 1
        assert "default/valid-pod" in logs
        assert logs["default/valid-pod"] == "Pod log line 1\nPod log line 2"
        mock_run.assert_called()
        # Verify call argument did not contain flag injection
        called_commands = [call.args[0] for call in mock_run.call_args_list]
        for cmd in called_commands:
            assert "--all" not in cmd
            assert ";" not in cmd
