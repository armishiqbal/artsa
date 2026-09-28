"""Unit tests for TargetAgent EDS (Escape Detection System) tool monitoring."""

from __future__ import annotations

import pytest

from src.agents.target_agent import TargetAgent
from src.models import GuardrailConfig, TargetConfig


@pytest.fixture
def mock_target_agent():
    config = TargetConfig(
        provider="deterministic",
        model="mock-target",
        guardrails=GuardrailConfig(
            input_content_filter=True,
            input_injection_detector=True,
            output_toxicity_filter=True,
        ),
    )
    return TargetAgent(config)


def test_target_agent_blocks_destructive_tool_call(mock_target_agent: TargetAgent):
    """When attack payload has metadata indicating dangerous tool execution, EDS terminates it."""
    attack_prompt = "rm -rf /"
    metadata = {
        "tool_name": "exec_command",
        "arguments": {"command": "rm -rf /"},
    }
    response = mock_target_agent.process(attack_prompt, metadata=metadata)
    assert response.blocked is True
    assert response.blocked_by == "eds_engine"
    assert response.response == "[BLOCKED BY ESCAPE DETECTION ENGINE]"
    assert any("EDS" in r.details for r in response.guardrail_trace if not r.passed)


def test_target_agent_allows_safe_tool_call(mock_target_agent: TargetAgent):
    """Benign tool calls are permitted by EDS and reach ordinary processing."""
    attack_prompt = "what is the current status?"
    metadata = {
        "tool_name": "get_status",
        "arguments": {"format": "json"},
    }
    response = mock_target_agent.process(attack_prompt, metadata=metadata)
    # Target deterministic model returns mock response without EDS block
    assert response.blocked_by != "eds_engine"
