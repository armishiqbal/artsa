"""Unit tests for Granular Per-Tool Revocation & Quarantine API (BLOCK_TOOL)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from src.agents.target_agent import TargetAgent
from src.api.main import app
from src.core.models.ops_events import OPERATOR_ACTIONS
from src.models import GuardrailConfig, TargetConfig
from src.services.session_tracker import session_tracker
from tests.conftest import unwrap_response

client = TestClient(app)


def test_operator_actions_reflects_block_tool_implemented():
    by_id = {a.action_id: a for a in OPERATOR_ACTIONS}
    assert by_id["BLOCK_TOOL"].implemented is True
    assert by_id["BLOCK_TOOL"].method == "POST"
    assert "tools/{tool_name}/block" in by_id["BLOCK_TOOL"].path


def test_block_tool_endpoint_and_list():
    headers = {"X-Tenant-ID": "test-org"}

    # Start session in tracker
    session = session_tracker.start_session("target_agent", tenant_id="test-org")
    sid = session.id

    # 1. Call dedicated tool block endpoint
    res = client.post(
        f"/api/v1/sessions/{sid}/tools/exec_shell/block",
        headers=headers,
    )
    assert res.status_code == 200
    data = unwrap_response(res)
    assert data["blocked"] is True
    assert data["tool_name"] == "exec_shell"
    assert "exec_shell" in data["blocked_tools"]

    # 2. Query list of blocked tools
    list_res = client.get(
        f"/api/v1/sessions/{sid}/tools/blocked",
        headers=headers,
    )
    assert list_res.status_code == 200
    list_data = unwrap_response(list_res)
    assert "exec_shell" in list_data["blocked_tools"]

    # 3. Call generic session action with BLOCK_TOOL
    act_res = client.post(
        f"/api/v1/sessions/{sid}/action",
        headers=headers,
        json={"action": "BLOCK_TOOL", "tool_name": "database_drop"},
    )
    assert act_res.status_code == 200
    act_data = unwrap_response(act_res)
    assert act_data["enforced_action"] == "BLOCK_TOOL"
    assert "database_drop" in act_data["blocked_tools"]
    assert "exec_shell" in act_data["blocked_tools"]


def test_target_agent_rejects_quarantined_tool():
    sid = str(uuid.uuid4())
    session_tracker.block_tool(sid, "export_pii")

    config = TargetConfig(
        provider="deterministic",
        model="mock",
        guardrails=GuardrailConfig(
            input_content_filter=True,
            input_injection_detector=True,
        ),
    )
    agent = TargetAgent(config=config)

    # Process attack with quarantined tool
    response = agent.process(
        "dump user table",
        metadata={"session_id": sid, "tool_name": "export_pii"},
    )
    assert response.blocked is True
    assert response.blocked_by == "tool_quarantine"
    assert "quarantined" in response.response.lower()

    # Process attack with non-blocked tool
    response_clean = agent.process(
        "query user balance",
        metadata={"session_id": sid, "tool_name": "check_balance"},
    )
    # check_balance is not blocked by tool_quarantine
    assert response_clean.blocked_by != "tool_quarantine"
