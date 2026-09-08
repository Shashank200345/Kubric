import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.insforge_client import InsForgeClient, _is_uuid

client = TestClient(app)

INVALID_UUIDS = [
    "invalid-uuid",
    "inv_12345",
    "12345,id=neq.0",
    "00000000-0000-0000-0000-000000000000&select=*",
    "' OR '1'='1",
]

VALID_UUID = "12345678-1234-5678-1234-567812345678"

def test_is_uuid_helper():
    assert _is_uuid(VALID_UUID) is True
    for invalid in INVALID_UUIDS:
        assert _is_uuid(invalid) is False
    assert _is_uuid("../../etc/passwd") is False

@pytest.mark.asyncio
async def test_insforge_client_uuid_validation(monkeypatch):
    monkeypatch.setenv("INSFORGE_URL", "https://mock.insforge.app")
    monkeypatch.setenv("INSFORGE_API_KEY", "mock-key")

    insforge = InsForgeClient()

    # Patch httpx.AsyncClient so if any HTTP request is attempted, we'll know
    with patch("httpx.AsyncClient.get") as mock_get, patch("httpx.AsyncClient.patch") as mock_patch:
        for invalid_id in INVALID_UUIDS:
            # get_investigation_details
            details = await insforge.get_investigation_details(invalid_id)
            assert details is None

            # get_action
            action = await insforge.get_action(invalid_id, "user_123")
            assert action is None

            # update_action_result
            updated = await insforge.update_action_result(invalid_id, "success", {"msg": "done"})
            assert updated is False

            # validate_cluster_token
            user_id, cluster_name = await insforge.validate_cluster_token(invalid_id)
            assert user_id is None
            assert cluster_name is None

        # Verify no HTTP calls were made for invalid UUIDs
        mock_get.assert_not_called()
        mock_patch.assert_not_called()

def test_get_investigation_progress_invalid_uuid():
    with patch("app.main.InsForgeClient") as MockInsForgeClient:
        mock_instance = AsyncMock()
        MockInsForgeClient.return_value = mock_instance

        for invalid_id in INVALID_UUIDS:
            response = client.get(f"/investigate/{invalid_id}/progress")
            assert response.status_code == 200
            assert response.json() == {"progress": []}

        # Verify InsForgeClient HTTP calls were not triggered for progress GET
        mock_instance.get.assert_not_called()
