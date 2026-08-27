"""Integration tests for FastAPI event ingestion endpoint."""

import uuid

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def _unwrap(resp) -> dict:
    """Unwrap the standardised API response envelope."""
    body = resp.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_api_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    # Health endpoint is excluded from envelope wrapping
    assert response.json()["status"] == "ok"


def test_api_ingest_event():
    payload = {
        "id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "agent_id": "test-agent-api",
        "tool_name": "read_file",
        "arguments": {"path": "/tmp/test.txt"},
        "trace_id": str(uuid.uuid4()),
    }
    response = client.post("/api/v1/ingest", json=payload)
    assert response.status_code in [200, 201]

    data = _unwrap(response)
    assert "ingested" in data
    assert "session_id" in data
    assert "verdict" in data
    assert "recommended_action" in data["verdict"]


def test_api_ingest_harness_health_check(monkeypatch):
    """Browser harnesses verify with {type: health_check, ping: true} — not a ToolCallEvent."""
    from src.core.config import settings

    monkeypatch.setattr(settings, "ARTSA_API_KEY", "test-secret-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    response = client.post(
        "/api/v1/ingest",
        json={"type": "health_check", "ping": True, "timestamp": "2026-08-26T18:50:11.933Z"},
        headers={"X-API-Key": "test-secret-key-12345"},
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data.get("ok") is True
    assert data.get("status") == "healthy"
    assert data.get("ping") is True
