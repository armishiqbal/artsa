"""Destructive MCP tool-call detector tests."""

import uuid

from src.containment.detectors.mcp_destructive import McpDestructiveToolDetector
from src.core.models.events import ToolCallEvent


def _event(tool: str, args: dict) -> ToolCallEvent:
    return ToolCallEvent(
        session_id=uuid.uuid4(),
        agent_id="test-agent",
        tool_name=tool,
        arguments=args,
    )


def test_destructive_mcp_tools_flagged():
    detector = McpDestructiveToolDetector()
    for tool_name in ["delete_user", "delete_user variant-9", "drop_table", "shell", "exec", "purge", "truncate"]:
        evt = detector.detect(_event("mcp_call", {"tool": tool_name, "input": "do it"}))
        assert evt is not None, f"expected MCP_DESTRUCTIVE_TOOL for: {tool_name}"
        assert evt.event_type == "MCP_DESTRUCTIVE_TOOL"
        assert evt.risk_score >= 85.0


def test_description_mention_not_flagged():
    """'admin delete' in the description must NOT trigger the tool-name rule."""
    detector = McpDestructiveToolDetector()
    evt = detector.detect(_event("mcp_call", {"tool": "get_user", "description_override": "admin delete variant-9"}))
    assert evt is None


def test_benign_mcp_tools_not_flagged():
    detector = McpDestructiveToolDetector()
    for tool_name in ["search", "read_file", "get_weather", "send_email", "list_users"]:
        assert detector.detect(_event("mcp_call", {"tool": tool_name, "input": "x"})) is None, tool_name


def test_non_mcp_tool_not_flagged():
    detector = McpDestructiveToolDetector()
    assert detector.detect(_event("execute_command", {"cmd": "delete_user"})) is None


def test_registered_in_engine_reaches_kill():
    from src.containment.engine import ContainmentEngine

    engine = ContainmentEngine()
    risk, verdict, _ = engine.evaluate_event(_event("mcp_call", {"tool": "delete_user", "input": "delete all users"}))
    assert risk.overall_score >= 80.0
    assert verdict.recommended_action == "KILL"
