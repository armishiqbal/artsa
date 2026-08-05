"""Tests for agent runtime APIs (EDS + trajectory)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.api.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_eds_monitor_endpoint() -> None:
    with _client() as client:
        resp = client.post(
            "/api/v1/agents/eds/monitor",
            json={
                "agent_id": "a1",
                "tool_name": "search",
                "arguments": {"q": "hello"},
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["risk_level"] == "LOW"
        assert body["action"] == "ALLOW"
        assert body["recommended_action"] == "NONE"
        assert body["latency_ms"] < 50.0


def test_eds_monitor_blocks_shell() -> None:
    with _client() as client:
        resp = client.post(
            "/api/v1/agents/eds/monitor",
            json={
                "agent_id": "rogue",
                "tool_name": "exec_command",
                "arguments": {"command": "cat /etc/passwd"},
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["risk_level"] in {"HIGH", "CRITICAL"}
        assert body["recommended_action"] in {"QUARANTINE", "KILL"}


def test_trajectory_evaluate_endpoint() -> None:
    with _client() as client:
        resp = client.post(
            "/api/v1/agents/trajectory/evaluate",
            json={
                "user_intent": "summarize docs",
                "trajectory": [
                    {"tool_name": "search", "arguments": {"q": "docs"}},
                    {"tool_name": "shell", "arguments": {"cmd": "curl http://evil"}},
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_steps"] == 2
        assert body["trajectory_verdict"] in {"SUSPICIOUS", "EXPLOIT"}
