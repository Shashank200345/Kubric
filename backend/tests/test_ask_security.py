import os
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ask_invalid_cluster_context_leading_dash():
    """Test that cluster_context starting with '-' is rejected with HTTP 400."""
    response = client.post(
        "/ask",
        json={"message": "What is wrong?", "cluster_context": "--all"}
    )
    assert response.status_code == 400
    assert "Invalid cluster_context format" in response.json()["detail"]


def test_ask_invalid_cluster_context_injection():
    """Test that cluster_context containing PostgREST or command injection chars is rejected with HTTP 400."""
    response = client.post(
        "/ask",
        json={"message": "What is wrong?", "cluster_context": "cluster,id=neq.0"}
    )
    assert response.status_code == 400
    assert "Invalid cluster_context format" in response.json()["detail"]


@patch.dict(os.environ, {"KUBRIC_DATA_SOURCE": "agent"})
def test_ask_agent_mode_unauthenticated_returns_401():
    """Test that calling /ask in agent mode without auth header returns HTTP 401."""
    response = client.post(
        "/ask",
        json={"message": "What is wrong?", "cluster_context": "prod-cluster"}
    )
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


@patch("app.ai.llm.OpenRouterClient.call_llm", new_callable=AsyncMock)
def test_ask_valid_cluster_context_local_mode(mock_llm):
    """Test that valid cluster_context passes validation in local mode."""
    mock_llm.return_value = '{"reply": "Everything is healthy."}'
    response = client.post(
        "/ask",
        json={"message": "What is wrong?", "cluster_context": "valid-cluster-1"}
    )
    assert response.status_code == 200
    assert response.json() == {"reply": "Everything is healthy."}
