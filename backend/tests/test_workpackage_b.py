"""WORKPACKAGE B — scoring integrity, false positives & availability.

Regression guards for the fixes in docs/WORKPACKAGE_B_SCORING_TRUST_AVAILABILITY.md:
  B1  entropy-as-privilege false positive killed (ls -la /tmp SAFE)
  B2  GOAL_DRIFT no longer fires on benign system files (read_file /etc/hosts SAFE)
  B3  composite score sub-scores explain the headline
  B4  dashboard defense-layer metrics are measured, never a constant 100.0
  B5  verdict reasoning names the deciding detector and surfaces evidence
  B6  MCP proxy single critical signal hard-blocks
  B7  root /health liveness probe returns 200
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from src.api.main import create_app
from src.api.routes.metrics import _compute_defense_layers
from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent
from src.services.mcp_proxy import MCPJsonRpcRequest, MCPProxyInterceptor
from src.services.telemetry_bus import telemetry_bus


def _evaluate(tool: str, args: dict):
    event = ToolCallEvent(
        session_id=uuid.uuid4(),
        agent_id="wp-b-agent",
        tool_name=tool,
        arguments=args,
    )
    return ContainmentEngine().evaluate_event(event)


# ── B1 / B2: availability — benign operations must be SAFE ───────────────────
def test_availability_ls_tmp_safe():
    risk, verdict, _ = _evaluate("exec_command", {"command": "ls -la /tmp"})
    assert risk.overall_score < 50.0, f"ls -la /tmp scored {risk.overall_score}"
    assert verdict.verdict == "SAFE"
    assert verdict.recommended_action == "NONE"


def test_availability_grep_log_safe():
    risk, verdict, _ = _evaluate("exec_command", {"command": "grep error /var/log/app.log"})
    assert risk.overall_score < 50.0
    assert verdict.recommended_action != "KILL"


def test_availability_read_hosts_safe():
    risk, verdict, _ = _evaluate("read_file", {"path": "/etc/hosts"})
    assert risk.overall_score < 50.0, f"read_file /etc/hosts scored {risk.overall_score}"
    assert verdict.recommended_action != "KILL"


# ── B1: destructive probes must stay >= 90 ───────────────────────────────────
def test_destructive_rm_rf_stays_killed():
    risk, verdict, _ = _evaluate("exec_command", {"command": "rm -rf /"})
    assert risk.overall_score >= 90.0
    assert verdict.recommended_action == "KILL"


def test_destructive_shadow_read_stays_killed():
    risk, verdict, _ = _evaluate("execute_command", {"command": "cat /etc/shadow"})
    assert risk.overall_score >= 90.0
    assert verdict.recommended_action == "KILL"


def test_destructive_metadata_probe_stays_killed():
    risk, verdict, _ = _evaluate(
        "execute_command", {"command": "curl http://169.254.169.254/latest/meta-data/"}
    )
    assert risk.overall_score >= 90.0
    assert verdict.recommended_action == "KILL"


# ── B3: composite explainability ─────────────────────────────────────────────
def test_explainability_sub_scores_explain_headline():
    risk, verdict, _ = _evaluate("read_file", {"path": "/etc/passwd"})
    assert risk.overall_score >= 80.0
    sub_scores = {
        "rule_based_score": risk.rule_based_score,
        "statistical_score": risk.statistical_score,
        "semantic_score": risk.semantic_score,
        "goal_drift_score": risk.goal_drift_score,
        "trajectory_score": risk.trajectory_score,
        "injection_score": risk.injection_score,
    }
    assert max(sub_scores.values()) >= 80.0, f"no sub-score >= 80 in {sub_scores}"
    assert "RuleBasedDetector" in verdict.reasoning


def test_no_all_zero_subscores_with_high_overall():
    risk, _, _ = _evaluate("exec_command", {"command": "cat /etc/shadow"})
    assert risk.overall_score >= 80.0
    assert risk.statistical_score >= 80.0  # statistical destructive-arg signal visible


# ── B4: defense-layer metrics honesty ────────────────────────────────────────
def test_defense_layers_empty_is_zero_not_100():
    layers = _compute_defense_layers([])
    assert layers, "expected all layers reported"
    assert all(value == 0.0 for value in layers.values()), "empty history must not fabricate 100.0"
    assert all(value != 100.0 for value in layers.values())


def test_defense_layers_measured_not_constant_100():
    layers = _compute_defense_layers(
        [
            {"verdict": "BREACHED", "detectors": ["RuleBasedDetector", "StatisticalDetector"]},
            {"verdict": "SAFE", "detectors": ["RuleBasedDetector"]},
        ]
    )
    # rule_inspector fired on both; only 1 was actually contained -> measured 50.0
    assert layers["rule_inspector"] == 50.0
    assert layers["statistical_inspector"] == 100.0  # 1/1 contained (measured)
    assert any(v != 100.0 for v in layers.values()), "layers must not all be 100.0"


def test_defense_layers_metric_endpoint_not_constant_100():
    telemetry_bus.clear()
    telemetry_bus.publish(
        {
            "type": "tool_call",
            "session_id": str(uuid.uuid4()),
            "tool_name": "exec_command",
            "risk_score": 40.0,
            "verdict": "SAFE",
            "severity": "MEDIUM",
            "detectors": ["RuleBasedDetector"],
            "flags": [],
            "enforced": False,
        }
    )
    with TestClient(create_app()) as client:
        resp = client.get("/api/v1/metrics/dashboard")
        assert resp.status_code == 200
        body = resp.json()
        layers = body.get("data", body).get("defense_layers", {})
    assert layers, "defense_layers should be populated"
    assert all(value != 100.0 for value in layers.values())


# ── B5: reasoning names the deciding detector ────────────────────────────────
def test_reasoning_names_deciding_detector():
    _, verdict, _ = _evaluate("exec_command", {"command": "rm -rf /"})
    assert "Deciding detector:" in verdict.reasoning
    assert "RuleBasedDetector" in verdict.reasoning
    assert "Evidence:" in verdict.reasoning


# ── B6: MCP proxy single-signal hard-deny ────────────────────────────────────
def test_mcp_single_dangerous_signal_blocks():
    interceptor = MCPProxyInterceptor()
    for name, payload in [
        ("delete_user", {"name": "delete_user", "input": "delete all users"}),
        ("passwd", {"name": "read_file", "input": "/etc/passwd"}),
        ("rm_rf", {"name": "exec", "input": "rm -rf /tmp/important"}),
    ]:
        res = interceptor.inspect_request(
            MCPJsonRpcRequest(method="tools/call", params=payload)
        )
        assert res.is_safe is False, f"{name} must block on a single signal"
        assert res.action_taken == "BLOCKED"
        assert res.threat_score >= 8.0


def test_mcp_benign_tools_list_passes():
    interceptor = MCPProxyInterceptor()
    res = interceptor.inspect_request(
        MCPJsonRpcRequest(method="tools/list", params={"filter": "public"})
    )
    assert res.is_safe is True
    assert res.action_taken == "PASSED"


# ── B7: root /health probe ───────────────────────────────────────────────────
def test_root_health_returns_200():
    with TestClient(create_app()) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body.get("data", body).get("status") == "ok"
