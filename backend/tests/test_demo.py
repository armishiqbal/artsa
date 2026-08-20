"""Phase 5.2 — the one-command per-class demos must pass (guardrail behaves)."""

from __future__ import annotations

import pytest
from scripts.demo import DEMOS
from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent


@pytest.mark.parametrize("cls", sorted(k for k in DEMOS if k != "benign"))
def test_attack_demos_are_flagged(cls: str) -> None:
    engine = ContainmentEngine()
    for tool, args, _expected in DEMOS[cls]:
        event = ToolCallEvent(session_id=__import__("uuid").uuid4(), agent_id="demo", tool_name=tool, arguments=args)
        risk, _, _ = engine.evaluate_event(event)
        assert risk.overall_score >= 50.0, f"{cls}: {tool} {args} scored {risk.overall_score:.0f}"


def test_benign_demo_is_not_flagged() -> None:
    engine = ContainmentEngine()
    for tool, args, _expected in DEMOS["benign"]:
        event = ToolCallEvent(session_id=__import__("uuid").uuid4(), agent_id="demo", tool_name=tool, arguments=args)
        risk, _, _ = engine.evaluate_event(event)
        assert risk.overall_score < 50.0, f"benign: {tool} {args} scored {risk.overall_score:.0f}"
