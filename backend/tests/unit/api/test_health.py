"""Enhanced health endpoint tests."""

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_health_includes_subsystems():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "subsystems" in body
    assert "database" in body["subsystems"]
    assert "redis" in body["subsystems"]
    assert body["subsystems"]["redis"] in ("live", "fallback")
    assert "oidc_enabled" in body["subsystems"]
    assert "rag_backend" in body["subsystems"]
    assert body.get("api_gateway", {}).get("status") == "fully_connected"
