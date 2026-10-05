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

            # get_investigation_details with invalid user_id
            details_inv_user = await insforge.get_investigation_details(VALID_UUID, user_id=invalid_id)
            assert details_inv_user is None

            # get_action
            action = await insforge.get_action(invalid_id, "user_123")
            assert action is None

            # get_action with invalid user_id
            action_inv_user = await insforge.get_action(VALID_UUID, invalid_id)
            assert action_inv_user is None

            # update_action_result
            updated = await insforge.update_action_result(invalid_id, "success", {"msg": "done"})
            assert updated is False

            # update_action_result with invalid user_id
            updated_inv_user = await insforge.update_action_result(VALID_UUID, "success", {"msg": "done"}, user_id=invalid_id)
            assert updated_inv_user is False

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

                created_inv_user = await insforge.create_investigation("default", invalid_id)
                assert created_inv_user is None

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


def test_get_investigation_progress_auth_and_scoping(monkeypatch):
    from tests.test_jwt_verification import make_jwt, SECRET

    monkeypatch.setenv("JWT_SECRET", SECRET)
    user_a = "11111111-1111-1111-1111-111111111111"
    token_a = make_jwt({"sub": user_a})

    # 1. Unauthenticated request to valid UUID returns 401
    response = client.get(f"/investigate/{VALID_UUID}/progress")
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}

    # 2. Authenticated request scoped to user ownership
    with patch("app.main.InsForgeClient") as MockInsForgeClient:
        mock_client = AsyncMock()
        MockInsForgeClient.return_value = mock_client

        # User A does not own the investigation
        mock_client.get_investigation_details.return_value = None
        response = client.get(
            f"/investigate/{VALID_UUID}/progress",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert response.status_code == 200
        assert response.json() == {"progress": []}
        mock_client.get_investigation_details.assert_called_once_with(VALID_UUID, user_id=user_a)

    # 3. Authenticated owner gets progress
    with patch("app.main.InsForgeClient") as MockInsForgeClient, \
         patch("httpx.AsyncClient.get") as mock_http_get:
        mock_client = AsyncMock()
        MockInsForgeClient.return_value = mock_client
        mock_client.get_investigation_details.return_value = {
            "user_id": user_a,
            "cluster_context": "test-cluster",
        }
        mock_client.base_url = "https://mock.insforge.app/api/database/records"
        mock_client.headers = {"Authorization": "Bearer mock"}

        mock_http_resp = AsyncMock()
        mock_http_resp.raise_for_status = lambda: None
        mock_http_resp.json = lambda: [{"step": "Checking Pods", "status": "running"}]
        mock_http_get.return_value = mock_http_resp

        response = client.get(
            f"/investigate/{VALID_UUID}/progress",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert response.status_code == 200
        assert response.json() == {"progress": [{"step": "Checking Pods", "status": "running"}]}
        mock_client.get_investigation_details.assert_called_once_with(VALID_UUID, user_id=user_a)

@pytest.mark.asyncio
async def test_get_investigation_details_user_id_scoping(monkeypatch):
    monkeypatch.setenv("INSFORGE_URL", "https://mock.insforge.app")
    monkeypatch.setenv("INSFORGE_API_KEY", "mock-key")

    insforge = InsForgeClient()
    investigation_id = VALID_UUID
    user_id = "87654321-4321-8765-4321-876543218765"

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None
        mock_response.json = lambda: [{"user_id": user_id, "cluster_context": "test-cluster"}]
        mock_get.return_value = mock_response

        # Scoped call
        res = await insforge.get_investigation_details(investigation_id, user_id=user_id)
        assert res == {"user_id": user_id, "cluster_context": "test-cluster"}
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert f"investigations?id=eq.{investigation_id}&user_id=eq.{user_id}&select=user_id,cluster_context" in args[0]


@pytest.mark.asyncio
async def test_update_action_result_user_id_scoping(monkeypatch):
    monkeypatch.setenv("INSFORGE_URL", "https://mock.insforge.app")
    monkeypatch.setenv("INSFORGE_API_KEY", "mock-key")

    insforge = InsForgeClient()
    action_id = VALID_UUID
    user_id = "87654321-4321-8765-4321-876543218765"

    with patch("httpx.AsyncClient.patch") as mock_patch:
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None
        mock_patch.return_value = mock_response

        # Scoped call
        res = await insforge.update_action_result(action_id, "success", {"message": "ok"}, user_id=user_id)
        assert res is True
        mock_patch.assert_called_once()
        args, kwargs = mock_patch.call_args
        assert f"actions?id=eq.{action_id}&user_id=eq.{user_id}" in args[0]


@pytest.mark.asyncio
async def test_record_heartbeat_uuid_validation(monkeypatch):
    monkeypatch.setenv("INSFORGE_URL", "https://mock.insforge.app")
    monkeypatch.setenv("INSFORGE_API_KEY", "mock-key")

    from app.main import _record_heartbeat

    with patch("httpx.AsyncClient.patch") as mock_patch, patch("httpx.AsyncClient.get") as mock_get:
        for invalid_id in INVALID_UUIDS:
            await _record_heartbeat(invalid_id, VALID_UUID)
            await _record_heartbeat(VALID_UUID, invalid_id)

        mock_patch.assert_not_called()
        mock_get.assert_not_called()


@pytest.mark.asyncio
async def test_update_progress_invalid_user_id(monkeypatch):
    monkeypatch.setenv("INSFORGE_URL", "https://mock.insforge.app")
    monkeypatch.setenv("INSFORGE_API_KEY", "mock-key")

    insforge = InsForgeClient()

    with patch("httpx.AsyncClient.post") as mock_post, patch("httpx.AsyncClient.get") as mock_get:
        mock_get_resp = AsyncMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json = lambda: [{"user_id": "invalid_fetched_user_id"}]
        mock_get.return_value = mock_get_resp

        mock_post_resp = AsyncMock()
        mock_post_resp.raise_for_status = lambda: None
        mock_post.return_value = mock_post_resp

        # Call update_progress with invalid user_id
        for invalid_id in INVALID_UUIDS:
            await insforge.update_progress(VALID_UUID, "Scanning Pods", user_id=invalid_id)

            # Assert mock_post was called with payload NOT containing user_id
            assert mock_post.called
            args, kwargs = mock_post.call_args
            payload = kwargs.get("json", {})
            assert "user_id" not in payload
            assert payload.get("session_id") == VALID_UUID
            assert payload.get("step") == "Scanning Pods"


def test_get_action_status_uuid_validation(monkeypatch):
    from tests.test_jwt_verification import make_jwt, SECRET

    monkeypatch.setenv("JWT_SECRET", SECRET)
    user_a = "11111111-1111-1111-1111-111111111111"
    token_a = make_jwt({"sub": user_a})

    with patch("app.main.InsForgeClient") as MockInsForgeClient:
        mock_instance = AsyncMock()
        MockInsForgeClient.return_value = mock_instance

        for invalid_id in INVALID_UUIDS:
            response = client.get(
                f"/api/v1/actions/{invalid_id}",
                headers={"Authorization": f"Bearer {token_a}"},
            )
            assert response.status_code == 400
            assert response.json() == {"detail": "Invalid action ID format"}

        # Verify InsForgeClient was not queried for invalid action IDs
        mock_instance.get_action.assert_not_called()
