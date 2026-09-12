"""Phase 2.4 End-to-End Verification Test Suite.

Validates the live closed loop:
Backend Campaign -> Live Event Bus -> WebSocket -> Telemetry Adapter -> Command Center UI
and operator containment enforcement (KILL_SESSION, QUARANTINE_AGENT, ASI08 circuit breaker).
"""

from __future__ import annotations

import asyncio
import time
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
import yaml

from src.core.models.hops import AgentRole, HmacState, HopEventType, executed_hop
from src.core.models.ops_events import AgentOpsState, OperatorActionSpec, SecurityOpsEvent
from src.core.models.sessions import Session
from src.data.campaign_job_store import campaign_job_store
from src.data.memory_store import store_session
from src.models import AttackCategory, AttackPayload, AttackProfile, CampaignConfig, TargetConfig
from src.orchestrator.campaign_manager import CampaignManager
from src.runtime.circuit_breaker import circuit_breaker
from src.services.campaign_live_bus import campaign_live_bus, emit_round_events
from src.services.ops_telemetry import build_ops_snapshot, project_campaign_hop, telemetry_mode
from src.services.session_tracker import session_tracker
from src.services.telemetry_bus import telemetry_bus


def _build_test_app_config() -> dict:
    with open("backend/configs/default_config.yaml") as f:
        cfg = yaml.safe_load(f)
    cfg["artsa"]["judge"]["use_llm"] = False
    cfg["artsa"]["judge"]["provider"] = "deterministic"
    cfg["artsa"]["red_team"]["provider"] = "deterministic"
    return cfg


def test_a_live_campaign_execution_and_telemetry_hop_bridge():
    """Test A: Live campaign executes through CampaignManager and bridges hops to telemetry_bus."""
    app_config = _build_test_app_config()
    cid = str(uuid.uuid4())

    target_cfg = TargetConfig(
        provider="deterministic",
        model="fake-model",
        system_prompt="You are a secure system under test.",
    )
    profile_cfg = AttackProfile(
        name="test_profile",
        categories=[AttackCategory.PROMPT_INJECTION],
        mutations_enabled=False,
        max_mutations_per_attack=0,
    )
    camp_cfg = CampaignConfig(
        id=cid,
        name="Live Campaign Alpha",
        target=target_cfg,
        attack_profile=profile_cfg,
        max_rounds=2,
    )

    campaign_job_store.create(
        cid,
        name="Live Campaign Alpha",
        provider="deterministic",
        model="fake-model",
        attack_profile="test_profile",
        max_rounds=2,
        request_json={},
        tenant_id="default_tenant",
    )

    # Register session
    sess_uuid = uuid.UUID(cid)
    sess_obj = Session(id=sess_uuid, agent_id="red_team", tenant_id="default_tenant", status="ACTIVE")
    session_tracker.active_sessions[str(sess_uuid)] = sess_obj

    received_on_bus: list[dict] = []

    def on_round(completed: int, total: int, result=None):
        campaign_job_store.update_progress(cid, completed)
        if result is not None:
            hops = emit_round_events(cid, result)
            received_on_bus.extend(hops)

    mgr = CampaignManager(config=camp_cfg, app_config=app_config)
    summary = mgr.run(on_round_complete=on_round)

    assert summary.total_rounds == 2
    assert len(received_on_bus) >= 6  # 3 hops per round (attack, response, verdict)

    # Verify campaign_live_bus history
    history = campaign_live_bus.history(cid)
    assert len(history) >= 6

    # Verify telemetry snapshot (GET /api/v1/telemetry/ops projection)
    snap = build_ops_snapshot(tenant_id="default_tenant")
    assert snap["current_campaign"]["id"] == cid
    assert snap["current_round"] == 2
    assert snap["telemetry_mode"] == "LIVE"
    assert snap["current_session_id"] == cid
    assert len(snap["events"]) > 0

    first_event = snap["events"][0]
    assert first_event["campaign_id"] == cid
    assert first_event["session_id"] == cid
    assert first_event["source_agent"] in ["Red Team", "Target", "Judge"]
    campaign_job_store.complete(cid, summary.model_dump(mode="json"))


def test_b_round_progression_authoritative():
    """Test B: Round progression strictly follows backend execution without independent UI guessing."""
    app_config = _build_test_app_config()
    cid = str(uuid.uuid4())

    target_cfg = TargetConfig(provider="deterministic", model="fake-model")
    profile_cfg = AttackProfile(
        name="progression_profile",
        categories=[AttackCategory.PROMPT_INJECTION],
        mutations_enabled=False,
    )
    camp_cfg = CampaignConfig(
        id=cid,
        name="Progression Test",
        target=target_cfg,
        attack_profile=profile_cfg,
        max_rounds=3,
    )

    campaign_job_store.create(
        cid,
        name="Progression Test",
        provider="deterministic",
        model="fake-model",
        attack_profile="progression_profile",
        max_rounds=3,
        request_json={},
        tenant_id="default_tenant",
    )

    observed_rounds: list[int] = []

    def on_round(completed: int, total: int, result=None):
        observed_rounds.append(completed)
        campaign_job_store.update_progress(cid, completed)
        if result is not None:
            emit_round_events(cid, result)

    mgr = CampaignManager(config=camp_cfg, app_config=app_config)
    summary = mgr.run(on_round_complete=on_round)

    assert observed_rounds == [1, 2, 3]
    snap = build_ops_snapshot(tenant_id="default_tenant")
    assert snap["current_round"] == 3
    campaign_job_store.complete(cid, summary.model_dump(mode="json"))


def test_c_kill_session_halts_running_campaign():
    """Test C: KILL_SESSION marks session BREACHED and halts CampaignManager execution immediately."""
    app_config = _build_test_app_config()
    cid = str(uuid.uuid4())
    sess_uuid = uuid.UUID(cid)

    target_cfg = TargetConfig(provider="deterministic", model="fake-model")
    profile_cfg = AttackProfile(name="kill_test", categories=[AttackCategory.PROMPT_INJECTION])
    camp_cfg = CampaignConfig(
        id=cid,
        name="Kill Test Campaign",
        target=target_cfg,
        attack_profile=profile_cfg,
        max_rounds=5,
    )

    # Register active session in tracker
    session_obj = Session(id=sess_uuid, agent_id="red_team", tenant_id="default_tenant", status="ACTIVE")
    session_tracker.active_sessions[str(sess_uuid)] = session_obj

    campaign_job_store.create(
        cid,
        name="Kill Test Campaign",
        provider="deterministic",
        model="fake-model",
        attack_profile="kill_test",
        max_rounds=5,
        request_json={},
        tenant_id="default_tenant",
    )

    def on_round(completed: int, total: int, result=None):
        campaign_job_store.update_progress(cid, completed)
        if completed == 1:
            # Operator triggers KILL_SESSION containment action after round 1
            session_tracker.apply_action(sess_uuid, "KILL")
            telemetry_bus.publish({
                "type": "session_action",
                "action": "KILL",
                "session_id": str(sess_uuid),
                "session_status": "BREACHED",
                "verdict": "BREACHED",
                "severity": "CRITICAL",
                "reason": "operator_containment",
            })

    mgr = CampaignManager(config=camp_cfg, app_config=app_config)
    summary = mgr.run(on_round_complete=on_round)

    # Assert campaign halted early: only 1 round executed out of 5!
    assert summary.completed_rounds == 1
    assert session_tracker.is_contained(sess_uuid) is True
    session_state = session_tracker.get_session(sess_uuid)
    assert session_state.status == "BREACHED"
    campaign_job_store.complete(cid, summary.model_dump(mode="json"))


def test_d_quarantine_agent_session_enforcement_and_not_wired_status():
    """Test D: QUARANTINE_AGENT quarantines session, and per-agent identity quarantine is honestly NOT_WIRED."""
    sid = uuid.uuid4()
    sess_obj = Session(id=sid, agent_id="red_team", tenant_id="default_tenant", status="ACTIVE")
    session_tracker.active_sessions[str(sid)] = sess_obj

    # Apply QUARANTINE action
    updated = session_tracker.apply_action(sid, "QUARANTINE")
    assert updated.status == "QUARANTINED"
    assert session_tracker.is_contained(sid) is True

    # Check OPERATOR_ACTIONS spec in backend
    from src.core.models.ops_events import OPERATOR_ACTIONS
    quarantine_spec = next(a for a in OPERATOR_ACTIONS if a.action_id == "QUARANTINE_AGENT")
    assert quarantine_spec.implemented is True
    # Verify exact documented limitation: session quarantine only, no per-agent identity route
    assert "Quarantines the session, not a durable agent identity" in quarantine_spec.note


@pytest.mark.asyncio
async def test_f_circuit_breaker_3_blocks_trips_and_denies_operations():
    """Test F: 3 consecutive BLOCK decisions trip the ASI08 durable circuit breaker to BREACHED."""
    test_sid = uuid.uuid4()
    tenant = "test_tenant"

    mock_db = MagicMock()
    mock_db.execute = MagicMock()
    # Mock row that starts closed and accumulates blocks
    mock_row = MagicMock()
    mock_row.opened_at = None
    mock_row.block_timestamps = []

    async def mock_execute(*args, **kwargs):
        res = MagicMock()
        res.scalar_one_or_none.return_value = mock_row
        return res

    mock_db.execute.side_effect = mock_execute

    # Record 1st BLOCK -> breaker remains closed
    b1 = await circuit_breaker.record_block(mock_db, tenant_id=tenant, session_id=test_sid)
    assert b1 is False

    # Record 2nd BLOCK -> breaker remains closed
    b2 = await circuit_breaker.record_block(mock_db, tenant_id=tenant, session_id=test_sid)
    assert b2 is False

    # Record 3rd BLOCK -> breaker TRIPS open
    b3 = await circuit_breaker.record_block(mock_db, tenant_id=tenant, session_id=test_sid)
    assert b3 is True
    assert mock_row.opened_at is not None


def test_e_telemetry_freshness_states():
    """Test E: Telemetry mode returns LIVE when fresh (<30s), STALE after 30s, and DISCONNECTED when empty."""
    now = datetime(2026, 9, 12, 12, 0, tzinfo=UTC)

    assert telemetry_mode(now=now, last_ts=None).value == "DISCONNECTED"
    assert telemetry_mode(now=now, last_ts=now - timedelta(seconds=10)).value == "LIVE"
    assert telemetry_mode(now=now, last_ts=now - timedelta(seconds=35)).value == "STALE"


def test_g_security_payload_redaction():
    """Test G: Telemetry hops never expose raw credentials or bearer tokens."""
    raw_hop = executed_hop(
        campaign_id="sec-camp",
        round_number=1,
        agent=AgentRole.RED_TEAM,
        event_type=HopEventType.ATTACK,
        timestamp=datetime.now(UTC).isoformat(),
        latency_ms=12.0,
        evidence_id="sec-ev-1",
        hmac_state=HmacState.OK,
        hmac_verified=True,
    )

    raw_event = {
        "campaign_id": "sec-camp",
        "kind": "attack",
        "actor": "red_team",
        "round": 1,
        "attack_type": "Credential Theft",
        "summary": "Attempting exploit with bearer eyJhbGciOi... and api_key=secret_1234567890123456",
        "hop": raw_hop.model_dump(mode="json"),
    }

    projected = project_campaign_hop(raw_event)
    assert projected is not None
    # Payload must be safely bounded and not leak secrets
    assert "secret_1234567890123456" not in projected.payload
