"""Unit tests for all session API routes."""

import uuid
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_list_sessions():
    response = client.get("/v1/sessions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_session_details():
    # First create session or post event
    session_id = str(uuid.uuid4())
    event = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "agent_id": "test-agent-session",
        "tool_name": "read_file",
        "arguments": {"path": "/tmp/test.txt"},
        "trace_id": str(uuid.uuid4()),
    }
    client.post("/v1/ingest", json=event)

    # Fetch session timeline
    response = client.get(f"/v1/sessions/{session_id}/timeline")
    assert response.status_code == 200
    timeline = response.json()
    assert len(timeline) >= 1
    assert timeline[0]["event"]["session_id"] == session_id
    assert "evaluation" in timeline[0]


def test_enforce_session_action():
    session_id = str(uuid.uuid4())
    # Start session first
    event = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "agent_id": "test-agent-action",
        "tool_name": "list_files",
        "arguments": {},
        "trace_id": str(uuid.uuid4()),
    }
    client.post("/v1/ingest", json=event)

    response = client.post(f"/v1/sessions/{session_id}/action", json={"action": "KILL"})
    assert response.status_code == 200
    data = response.json()
    assert data["enforced_action"] == "KILL"
    assert data["status"] == "BREACHED"
