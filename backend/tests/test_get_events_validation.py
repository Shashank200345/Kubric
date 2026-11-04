import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_events_default_limit(monkeypatch):
    monkeypatch.setattr("app.main._use_agent_source", lambda: False)
    monkeypatch.setattr("app.kubernetes.executor.KubectlExecutor.run", lambda cmd, parse_json=True, context=None: {"items": []})
    response = client.get("/events")
    assert response.status_code == 200
    assert "events" in response.json()

def test_get_events_valid_limit(monkeypatch):
    monkeypatch.setattr("app.main._use_agent_source", lambda: False)
    monkeypatch.setattr("app.kubernetes.executor.KubectlExecutor.run", lambda cmd, parse_json=True, context=None: {"items": []})
    response = client.get("/events?limit=10")
    assert response.status_code == 200

def test_get_events_invalid_limit_zero(monkeypatch):
    response = client.get("/events?limit=0")
    assert response.status_code == 422

def test_get_events_invalid_limit_negative(monkeypatch):
    response = client.get("/events?limit=-5")
    assert response.status_code == 422

def test_get_events_invalid_limit_exceeds_max(monkeypatch):
    response = client.get("/events?limit=101")
    assert response.status_code == 422
