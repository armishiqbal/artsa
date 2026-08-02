"""WebSocket authentication tests."""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.core.config import settings

client = TestClient(app)


def test_websocket_connects_in_testing():
    with client.websocket_connect("/api/v1/websocket") as ws:
        data = ws.receive_json()
        assert data["type"] == "history"


def test_websocket_rejects_without_key_when_required(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_API_KEY", "ws-test-secret-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    with pytest.raises(Exception):
        with client.websocket_connect("/api/v1/websocket"):
            pass


def test_websocket_accepts_query_api_key(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_API_KEY", "ws-test-secret-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    with client.websocket_connect("/api/v1/websocket?api_key=ws-test-secret-key-12345") as ws:
        data = ws.receive_json()
        assert data["type"] == "history"
