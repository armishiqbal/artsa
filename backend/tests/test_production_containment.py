"""Production containment path: auto-enforce + block contained sessions."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.main import create_app
from src.core.config import settings
from src.services.telemetry_bus import telemetry_bus


@pytest.fixture(autouse=True)
def _clear_bus() -> None:
    telemetry_bus.clear()
    yield
    telemetry_bus.clear()


def _client() -> TestClient:
    return TestClient(create_app())


def _event(session_id: str, tool: str = "read_file", path: str = "/tmp/x") -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "agent_id": "prod-agent",
        "tool_name": tool,
        "arguments": {"path": path},
        "trace_id": str(uuid.uuid4()),
    }


def _unwrap(resp) -> dict:
    """Unwrap the standardised API response envelope."""
    body = resp.json()
    return body.get("data", body) if isinstance(body, dict) else body


def test_ready_endpoint_ok_in_testing() -> None:
    with _client() as client:
        resp = client.get("/api/v1/ready")
        assert resp.status_code == 200
        body = resp.json()
        # Ready endpoint is excluded from envelope wrapping
        assert body["status"] == "ready"
        assert "checks" in body


def test_ingest_returns_enforcement_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ARTSA_AUTO_ENFORCE", True)
    sid = str(uuid.uuid4())
    with _client() as client:
        resp = client.post("/api/v1/ingest", json=_event(sid))
        assert resp.status_code in (200, 201)
        data = _unwrap(resp)
        assert "verdict" in data
        assert "recommended_action" in data["verdict"]
        assert "evaluations" in data
        assert "session_status" in data


def test_manual_quarantine_blocks_further_ingest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ARTSA_BLOCK_CONTAINED_SESSIONS", True)
    monkeypatch.setattr(settings, "ARTSA_AUTO_ENFORCE", True)
    sid = str(uuid.uuid4())
    with _client() as client:
        first = client.post("/api/v1/ingest", json=_event(sid))
        assert first.status_code in (200, 201)

        action = client.post(f"/api/v1/sessions/{sid}/action", json={"action": "QUARANTINE"})
        assert action.status_code == 200
        assert _unwrap(action)["status"] == "QUARANTINED"

        blocked = client.post("/api/v1/ingest", json=_event(sid, tool="execute_command"))
        assert blocked.status_code == 403
        block_body = blocked.json()
        # Error responses may be wrapped in the error envelope — handle both shapes
        detail = block_body.get("detail", block_body.get("error", {}))
        if isinstance(detail, dict):
            assert "contained" in str(detail).lower() or detail.get("session_status") == "QUARANTINED"
        else:
            assert "contained" in str(detail).lower()


def test_kill_action_marks_breached() -> None:
    sid = str(uuid.uuid4())
    with _client() as client:
        client.post("/api/v1/ingest", json=_event(sid))
        action = client.post(f"/api/v1/sessions/{sid}/action", json={"action": "KILL"})
        assert action.status_code == 200
        data = _unwrap(action)
        assert data["status"] == "BREACHED"
        assert data["enforced_action"] == "KILL"
