"""Unit tests for the installable artsa Python SDK client helpers."""

from __future__ import annotations

from artsa.client import ArtsaBlockedError, ArtsaClient


def test_is_blocked_detects_kill() -> None:
    client = ArtsaClient()
    assert client.is_blocked(
        {"verdict": {"recommended_action": "KILL", "verdict": "BREACHED"}}
    )
    assert not client.is_blocked(
        {"verdict": {"recommended_action": "NONE", "verdict": "SAFE"}}
    )


def test_is_blocked_on_contained_session_status() -> None:
    client = ArtsaClient()
    assert client.is_blocked(
        {
            "verdict": {"recommended_action": "NONE", "verdict": "SAFE"},
            "session_status": "QUARANTINED",
        }
    )


def test_fail_closed_fallback() -> None:
    client = ArtsaClient(api_url="http://127.0.0.1:1", timeout=0.05, fail_closed=True, max_retries=0)
    result = client.monitor_tool_call("s", "a", "t", {})
    assert result["verdict"]["recommended_action"] == "KILL"


def test_guard_raises_on_block(monkeypatch) -> None:
    client = ArtsaClient()

    def fake_monitor(*_a, **_k):
        return {
            "verdict": {
                "recommended_action": "QUARANTINE",
                "reasoning": "suspicious",
                "verdict": "SUSPICIOUS",
            },
            "risk_score": {"overall_score": 70.0},
        }

    monkeypatch.setattr(client, "monitor_tool_call", fake_monitor)
    try:
        client.guard_tool_call("s", "a", "shell", {"cmd": "id"})
        raised = False
    except ArtsaBlockedError:
        raised = True
    assert raised


def test_score_tool_call_normalizes_risk(monkeypatch) -> None:
    client = ArtsaClient()

    def fake_monitor(*_a, **_k):
        return {
            "verdict": {"recommended_action": "ALERT", "verdict": "SUSPICIOUS"},
            "risk_score": {"overall_score": 62.0, "flags": ["PROMPT_INJECTION"]},
        }

    monkeypatch.setattr(client, "monitor_tool_call", fake_monitor)
    scored = client.score_tool_call("s", "a", "send_email", {"body": "test"})
    assert scored["overall_score"] == 62.0
    assert scored["verdict"] == "SUSPICIOUS"
    assert scored["blocked"] is False
    assert "PROMPT_INJECTION" in scored["flags"]
