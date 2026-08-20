"""Phase 6.4 — the MCP Kill-Chain Test Rig must stay green (regression gate)."""

from __future__ import annotations

import pytest
from scripts.mcp_rig import SCENARIOS
from src.services.mcp_proxy import MCPJsonRpcRequest, MCPProxyInterceptor


@pytest.mark.parametrize("scenario", SCENARIOS)
def test_mcp_rig_scenario(scenario) -> None:
    name, method, tool, params, expected = scenario
    interceptor = MCPProxyInterceptor()
    req = MCPJsonRpcRequest(method=method, params={"name": tool, **params})
    res = interceptor.inspect_request(req)
    contained = getattr(res, "is_safe", True) is False
    assert contained == expected, f"{name}: expected contained={expected}, got {contained}"
