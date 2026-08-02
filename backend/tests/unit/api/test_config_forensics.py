"""Smoke tests for config and forensics API routes."""

import uuid
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_config_keys_endpoint():
    response = client.get("/api/v1/config/keys")
    assert response.status_code == 200
    data = response.json()
    assert "keys" in data
    assert "summary" in data


def test_config_providers_endpoint():
    response = client.get("/api/v1/config/providers")
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert "guardrails" in data


def test_forensics_analyze():
    response = client.post(
        "/api/v1/forensics/analyze",
        json={"events": [{"tool_name": "exec_command", "arguments": {"cmd": "ls"}}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 1
    assert "forensic_summary" in data


def test_compliance_export():
    response = client.post(
        "/api/v1/compliance/export",
        json={"name": "test", "total_rounds": 3, "avg_defense_quality": 8.0},
    )
    assert response.status_code == 200
    assert "report_markdown" in response.json()


def test_ingest_timeline_with_evaluation():
    session_id = str(uuid.uuid4())
    event = {
        "session_id": session_id,
        "agent_id": "test-agent",
        "tool_name": "delete_user",
        "arguments": {"username": "admin"},
        "trace_id": str(uuid.uuid4()),
    }
    ingest = client.post("/api/v1/ingest", json=event)
    assert ingest.status_code == 201

    timeline = client.get(f"/api/v1/sessions/{session_id}/timeline")
    assert timeline.status_code == 200
    entries = timeline.json()
    assert len(entries) >= 1
    assert entries[0]["evaluation"] is not None
    assert entries[0]["evaluation"]["risk_score"] > 0
