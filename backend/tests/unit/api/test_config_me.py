"""Tests for /config/me identity endpoint."""

from fastapi.testclient import TestClient

from src.api.main import app
from src.core.config import settings
from tests.conftest import unwrap_response

client = TestClient(app)


def test_config_me_defaults_to_admin_without_key(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_API_KEY", None)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    response = client.get("/api/v1/config/me")
    assert response.status_code == 200
    body = unwrap_response(response)
    assert body["role"] == "admin"
    assert body["capabilities"]["can_run_campaigns"] is True


def test_config_me_readonly_key(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_READONLY_API_KEY", "readonly-test-key-12345")
    monkeypatch.setattr(settings, "ARTSA_API_KEY", "admin-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    response = client.get(
        "/api/v1/config/me",
        headers={"X-API-Key": "readonly-test-key-12345"},
    )
    assert response.status_code == 200
    body = unwrap_response(response)
    assert body["role"] == "readonly"
    assert body["capabilities"]["read_only"] is True
    assert body["capabilities"]["can_run_campaigns"] is False
