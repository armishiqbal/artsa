"""Auth middleware tests."""

from fastapi.testclient import TestClient

from src.api.main import app
from src.core.config import settings
from tests.conftest import unwrap_response


def test_health_public_without_key():
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200


def test_config_requires_key_when_set(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_API_KEY", "test-secret-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    client = TestClient(app)
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 401

    response = client.get("/api/v1/config/keys", headers={"X-API-Key": "test-secret-key-12345"})
    assert response.status_code == 200


def test_readonly_key_accepted_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_API_KEY", "admin-secret-key-12345")
    monkeypatch.setattr(settings, "ARTSA_READONLY_API_KEY", "readonly-secret-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    client = TestClient(app)
    response = client.get(
        "/api/v1/config/me",
        headers={"X-API-Key": "readonly-secret-key-12345"},
    )
    assert response.status_code == 200
    assert unwrap_response(response)["role"] == "readonly"


def test_production_requires_api_key(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ARTSA_API_KEY", None)
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    client = TestClient(app)
    response = client.get("/api/v1/sessions")
    assert response.status_code == 503
