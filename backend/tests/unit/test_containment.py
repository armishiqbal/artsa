"""Unit tests for containment detectors and scoring engine."""

import uuid
from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent


def test_rule_based_detector_destructive_command():
    engine = ContainmentEngine()
    evt = ToolCallEvent(
        session_id=uuid.uuid4(),
        agent_id="test-agent",
        tool_name="exec_command",
        arguments={"command": "rm -rf /"},
    )
    score, verdict, sec_events = engine.evaluate_event(evt)
    assert score.overall_score >= 80.0
    assert verdict.verdict == "BREACHED"
    assert verdict.recommended_action == "KILL"
    assert len(sec_events) > 0


def test_rule_based_detector_safe_command():
    engine = ContainmentEngine()
    evt = ToolCallEvent(
        session_id=uuid.uuid4(),
        agent_id="test-agent",
        tool_name="search_docs",
        arguments={"query": "security guidelines"},
    )
    score, verdict, sec_events = engine.evaluate_event(evt)
    assert score.overall_score < 50.0
    assert verdict.verdict == "SAFE"
    assert verdict.recommended_action == "NONE"
