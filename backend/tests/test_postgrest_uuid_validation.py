import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.insforge_client import InsForgeClient, _is_uuid, _is_cluster_name

client = TestClient(app)

INVALID_CLUSTER_NAMES = [
    "prod-cluster,id=neq.0",
    "cluster1&user_id=eq.123",
    "cluster1=eq.2",
    "cluster1?select=*",
    "' OR '1'='1",
    "../../etc/passwd",
]

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


def test_is_cluster_name_helper():
    assert _is_cluster_name("my-cluster-1") is True
    assert _is_cluster_name("prod_cluster.us-east") is True
    for invalid in INVALID_CLUSTER_NAMES:
        assert _is_cluster_name(invalid) is False
    assert _is_cluster_name(None) is False

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

            # get_action with invalid user_id
            action_inv_user = await insforge.get_action(VALID_UUID, invalid_id)
            assert action_inv_user is None

            # update_action_result
            updated = await insforge.update_action_result(invalid_id, "success", {"msg": "done"})
            assert updated is False

            # validate_cluster_token
            user_id, cluster_name = await insforge.validate_cluster_token(invalid_id)
            assert user_id is None
            assert cluster_name is None

            # get_pending_actions with invalid user_id or invalid cluster_name
            pending = await insforge.get_pending_actions(invalid_id, "default")
            assert pending == []

            for invalid_cluster in INVALID_CLUSTER_NAMES:
                pending_inv_cluster = await insforge.get_pending_actions(VALID_UUID, invalid_cluster)
                assert pending_inv_cluster == []

            # get_cluster_state with invalid user_id
            state = await insforge.get_cluster_state("default", invalid_id)
            assert state is None

            # list_state_clusters with invalid user_id
            clusters = await insforge.list_state_clusters(invalid_id)
            assert clusters == []

            # get_cluster_state with invalid cluster_name
            state_inv_cluster = await insforge.get_cluster_state("invalid,cluster=1", VALID_UUID)
            assert state_inv_cluster is None

        with patch("httpx.AsyncClient.post") as mock_post:
            # upsert_cluster_state with invalid cluster_name
            upsert_inv_cluster = await insforge.upsert_cluster_state(VALID_UUID, "invalid,cluster=1", {})
            assert upsert_inv_cluster is False

            # create_investigation with invalid cluster_context
            for invalid_cluster in INVALID_CLUSTER_NAMES:
                created_inv = await insforge.create_investigation(invalid_cluster, VALID_UUID)
                assert created_inv is None

                # create_action with invalid parameters
                act1 = await insforge.create_action(VALID_UUID, "restart_pod", {}, VALID_UUID, invalid_cluster)
                assert act1 is None

            for invalid_id in INVALID_UUIDS:
                act2 = await insforge.create_action(invalid_id, "restart_pod", {}, VALID_UUID, "default")
                assert act2 is None

                act3 = await insforge.create_action(VALID_UUID, "restart_pod", {}, invalid_id, "default")
                assert act3 is None

            mock_post.assert_not_called()

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
