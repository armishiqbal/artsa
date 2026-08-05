"""Tests for ContainedAgent runtime."""

from __future__ import annotations

from artsa.agent import ContainedAgent
from artsa.client import ArtsaBlockedError, ArtsaClient


def test_contained_agent_calls_safe_tool(monkeypatch) -> None:
    client = ArtsaClient(fail_closed=False)

    def fake_monitor(*_a, **_k):
        return {"verdict": {"recommended_action": "NONE", "verdict": "SAFE"}}

    monkeypatch.setattr(client, "monitor_tool_call", fake_monitor)
    agent = ContainedAgent(client, agent_id="demo", session_id="s1")
    agent.register("ping", lambda: "pong")
    assert agent.call("ping") == "pong"


def test_contained_agent_blocks_and_marks_contained(monkeypatch) -> None:
    client = ArtsaClient()

    def fake_monitor(*_a, **_k):
        return {
            "verdict": {
                "recommended_action": "KILL",
                "reasoning": "breach",
                "verdict": "BREACHED",
            }
        }

    monkeypatch.setattr(client, "monitor_tool_call", fake_monitor)
    agent = ContainedAgent(client, agent_id="demo", session_id="s1")
    agent.register("shell", lambda cmd: cmd)
    try:
        agent.call("shell", cmd="id")
        raised = False
    except ArtsaBlockedError:
        raised = True
    assert raised
    assert agent.contained is True
