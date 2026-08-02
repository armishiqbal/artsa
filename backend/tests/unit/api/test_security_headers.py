"""Security headers middleware tests."""

from fastapi.testclient import TestClient

from src.api.main import app
from src.core.config import settings

client = TestClient(app)


def test_security_headers_on_health(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
