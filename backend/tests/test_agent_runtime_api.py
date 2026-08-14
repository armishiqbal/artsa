"""Tests for agent runtime APIs (EDS + trajectory)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.api.main import create_app
from tests.conftest import unwrap_response


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
        body = unwrap_response(resp)
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
        body = unwrap_response(resp)
        assert body["risk_level"] in {"HIGH", "CRITICAL"}
        assert body["recommended_action"] in {"QUARANTINE", "KILL"}


def test_trajectory_evaluate_endpoint() -> None:
    """Trajectory verdicts follow the WORKPACKAGE B policy:

    - multi-step drift (2+ anomalous steps) -> EXPLOIT
    - a single genuinely-dangerous step (dangerous tool / destructive
      construct / external-network exfil) -> EXPLOIT without waiting for drift
    - a 2-step session with one external-network step -> SUSPICIOUS
    - a single benign step, or a single sensitive-file read -> BENIGN (the
      latter belongs to the dedicated SENSITIVE_DATA_EXPOSED detectors, not
      GOAL_DRIFT — see workpackage B2).
    """

    def _verdict(steps: list[dict]) -> dict:
        with _client() as client:
            resp = client.post(
                "/api/v1/agents/trajectory/evaluate",
                json={"user_intent": "summarize docs", "trajectory": steps},
            )
            assert resp.status_code == 200
            return unwrap_response(resp)

    # 2-step trajectory with one step reaching an external host -> SUSPICIOUS.
    body = _verdict(
        [
            {"tool_name": "search", "arguments": {"q": "docs"}},
            {"tool_name": "shell", "arguments": {"cmd": "curl http://evil"}},
        ]
    )
    assert body["total_steps"] == 2
    assert body["trajectory_verdict"] == "SUSPICIOUS"

    # A single genuinely-dangerous invocation flags immediately (no drift needed).
    assert (
        _verdict([{"tool_name": "delete_user", "arguments": {"user_id": "admin"}}])[
            "trajectory_verdict"
        ]
        == "EXPLOIT"
    )

    # A single sensitive-file read is NOT GOAL_DRIFT (dedicated detectors' domain).
    assert (
        _verdict([{"tool_name": "read_file", "arguments": {"path": "/etc/passwd"}}])[
            "trajectory_verdict"
        ]
        == "BENIGN"
    )

    # A single benign step stays BENIGN.
    assert (
        _verdict([{"tool_name": "search", "arguments": {"q": "docs"}}])[
            "trajectory_verdict"
        ]
        == "BENIGN"
    )

    # Two consecutive dangerous steps -> EXPLOIT (multi-step drift).
    assert (
        _verdict(
            [
                {"tool_name": "shell", "arguments": {"cmd": "cat /etc/shadow"}},
                {"tool_name": "delete_user", "arguments": {"user_id": "admin"}},
            ]
        )["trajectory_verdict"]
        == "EXPLOIT"
    )
