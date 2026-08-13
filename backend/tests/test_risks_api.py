"""Tests for the Agentic Risk Framework API (/api/v1/risks)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.main import create_app
from src.services.telemetry_bus import telemetry_bus
from tests.conftest import unwrap_response


def _client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture(autouse=True)
def _clear_telemetry_bus() -> None:
    telemetry_bus.clear()
    yield
    telemetry_bus.clear()


def test_risk_framework_returns_all_ten_risks() -> None:
    with _client() as client:
        resp = client.get("/api/v1/risks")
        assert resp.status_code == 200
        payload: dict[str, Any] = unwrap_response(resp)
        framework = payload["framework"]
        assert len(framework) == 10
        names = [row["name"] for row in framework]
        assert "Agent Goal Hijack" in names
        assert "Rogue Agents" in names
        assert [row["rank"] for row in framework] == list(range(1, 11))
        for row in framework:
            assert row["id"]
            assert row["description"]
            assert row["attack_categories"]
            assert row["defense_layers"]
            assert row["detectors"]
            assert row["mitigations"]
            assert isinstance(row["live_events"], int)
            assert isinstance(row["blocked_events"], int)
            assert isinstance(row["breached_events"], int)
            assert 0.0 <= row["max_risk_score"] <= 100.0
            assert row["severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_risk_counts_reflect_telemetry_flags() -> None:
    telemetry_bus.publish(
        {
            "type": "tool_call",
            "session_id": "t1",
            "agent_id": "a1",
            "tool_name": "web_search",
            "risk_score": 91.0,
            "verdict": "BLOCKED",
            "flags": ["PROMPT_INJECTION", "GOAL_DRIFT"],
        }
    )
    telemetry_bus.publish(
        {
            "type": "tool_call",
            "session_id": "t2",
            "agent_id": "a2",
            "tool_name": "read_file",
            "risk_score": 55.0,
            "verdict": "PARTIAL",
            "flags": ["SANDBOX_ESCAPE", "PRIVILEGE_ESCALATION"],
        }
    )
    with _client() as client:
        payload: dict[str, Any] = unwrap_response(client.get("/api/v1/risks"))
        by_id = {row["id"]: row for row in payload["framework"]}

    hijack = by_id["agent-goal-hijack"]
    assert hijack["live_events"] >= 1
    assert hijack["blocked_events"] >= 1
    assert hijack["breached_events"] == 0
    assert hijack["max_risk_score"] >= 91.0
    assert hijack["severity"] == "CRITICAL"

    misuse = by_id["tool-misuse-exploitation"]
    assert misuse["live_events"] >= 1
    assert misuse["max_risk_score"] >= 55.0
    assert misuse["severity"] == "HIGH"


def test_breached_verdict_not_counted_as_blocked() -> None:
    telemetry_bus.publish(
        {
            "type": "tool_call",
            "session_id": "t3",
            "agent_id": "a3",
            "tool_name": "execute_command",
            "risk_score": 88.0,
            "verdict": "BREACHED",
            "flags": ["PROMPT_INJECTION"],
        }
    )
    with _client() as client:
        payload: dict[str, Any] = unwrap_response(client.get("/api/v1/risks"))
        hijack = next(r for r in payload["framework"] if r["id"] == "agent-goal-hijack")
    assert hijack["live_events"] >= 1
    assert hijack["blocked_events"] == 0
    assert hijack["breached_events"] >= 1
