"""Integration test for POST /v1/ingest pipeline with 100 events."""

import uuid

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def _unwrap(resp) -> dict:
    """Unwrap the standardised API response envelope."""
    body = resp.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_bulk_ingest_100_events():
    session_id = str(uuid.uuid4())
    events = [
        {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "agent_id": "test-agent-bulk",
            "tool_name": f"tool_{i % 5}",
            "arguments": {"arg_index": i},
            "trace_id": str(uuid.uuid4()),
        }
        for i in range(100)
    ]

    response = client.post("/v1/ingest", json=events)
    assert response.status_code == 201
    data = _unwrap(response)
    assert data["ingested"] == 100
    assert data["session_id"] == session_id
