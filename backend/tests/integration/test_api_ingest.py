"""Integration tests for FastAPI event ingestion endpoint."""

import uuid
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_api_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
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
    assert response.status_code == 200
    data = response.json()
    assert "risk_score" in data
    assert "verdict" in data
