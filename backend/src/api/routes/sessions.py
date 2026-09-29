"""Sessions Management and Telemetry Stream Endpoints."""

import json
import logging
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db, get_session_tracker
from src.api.ws_auth import require_ws_auth
from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session
from src.data import memory_store
from src.data.orm import SessionCircuitBreakerORM
from src.data.repositories.evaluations import EvaluationRepository
from src.data.repositories.events import EventRepository
from src.data.repositories.sessions import SessionRepository
from src.services.session_tracker import SessionTracker
from src.services.telemetry_bus import telemetry_bus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sessions"])


class SessionActionRequest(BaseModel):
    action: Literal["KILL", "QUARANTINE", "THROTTLE", "ALERT", "RELEASE", "CLOSE", "BLOCK_TOOL", "DEPLOY_MITIGATION"] = Field(
        ..., description="Action to enforce on agent session (RELEASE/CLOSE are incident workflow, BLOCK_TOOL is tool quarantine, DEPLOY_MITIGATION is policy hotpatch)"
    )
    tool_name: str | None = Field(default=None, description="Tool name to quarantine when action is BLOCK_TOOL")


class SessionMitigateRequest(BaseModel):
    rule_name: str | None = Field(default=None, description="Descriptive name for the mitigation rule")
    content: str | None = Field(default=None, description="Offending attack payload or trigger phrase")
    trigger_phrases: list[str] = Field(default_factory=list, description="Specific trigger phrases to block")
    pattern: str | None = Field(default=None, description="Explicit regex pattern to enforce; synthesized if omitted")
    event_type: str = Field(default="PROMPT_INJECTION", description="Detector event category (e.g. PROMPT_INJECTION, TOOL_ABUSE)")
    severity: str = Field(default="HIGH", description="Severity of the mitigation rule")
    risk_score: float = Field(default=85.0, ge=0.0, le=100.0, description="Risk score assigned to matches")
    tool: str | None = Field(default=None, description="Optional tool name to scope this rule to")
    hot_patch_semantic: bool = Field(default=True, description="Also register pattern in DynamicSemanticRegistry")


class TimelineEntry(BaseModel):
    event: ToolCallEvent
    evaluation: dict[str, Any] | None = None


_ACTION_TARGET_STATUS = {
    "KILL": "BREACHED",
    "QUARANTINE": "QUARANTINED",
    "CLOSE": "CLOSED",
    "RELEASE": "ACTIVE",
}


def _lookup_session(session_id: uuid.UUID, tracker: SessionTracker) -> Session | None:
    return tracker.get_session(session_id) or memory_store.get_session(session_id)


async def _with_breaker_state(sessions: list[Session], db: AsyncSession, tenant_id: str) -> list[Session]:
    if not sessions or not hasattr(db, "execute"):
        return sessions
    rows = (await db.execute(
        select(SessionCircuitBreakerORM.session_id).where(
            SessionCircuitBreakerORM.tenant_id == tenant_id,
            SessionCircuitBreakerORM.opened_at.is_not(None),
        )
    )).scalars().all()
    opened = set(rows)
    return [session.model_copy(update={"circuit_breaker_open": str(session.id) in opened}) for session in sessions]


async def _require_tenant_session(
    session_id: uuid.UUID,
    tenant_id: str,
    tracker: SessionTracker,
    db: AsyncSession,
) -> Session:
    session = _lookup_session(session_id, tracker)
    if not session:
        repo = SessionRepository(db)
        session = await repo.get_session(session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    return session


@router.get("/sessions", response_model=list[Session])
async def list_sessions(
    tenant_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    current_tenant: str = Depends(get_current_tenant),
):
    """List agent sessions for the authenticated tenant only."""
    del tenant_id  # callers cannot select another org via query string
    effective_tenant = current_tenant
    active = list(tracker.active_sessions.values())
    if effective_tenant:
        active = [s for s in active if s.tenant_id == effective_tenant]
    if status:
        active = [s for s in active if s.status == status]
    if active:
        return await _with_breaker_state(active[offset : offset + limit], db, effective_tenant)

    repo = SessionRepository(db)
    rows = await repo.list_sessions(tenant_id=effective_tenant, status=status, limit=limit, offset=offset)
    return await _with_breaker_state(rows, db, effective_tenant)


@router.get("/sessions/{session_id}", response_model=Session)
async def get_session_details(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    tenant_id: str = Depends(get_current_tenant),
):
    """Fetch details for a specific session by UUID."""
    session = await _require_tenant_session(session_id, tenant_id, tracker, db)
    return (await _with_breaker_state([session], db, tenant_id))[0]


@router.get("/sessions/{session_id}/timeline", response_model=list[TimelineEntry])
async def get_session_timeline(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    tenant_id: str = Depends(get_current_tenant),
):
    """Return tool call events with containment evaluations ordered by timestamp."""
    await _require_tenant_session(session_id, tenant_id, tracker, db)
    event_repo = EventRepository(db)
    eval_repo = EvaluationRepository(db)

    tracked_events = tracker.session_events.get(str(session_id), [])
    events = tracked_events if tracked_events else await event_repo.get_by_session(session_id)
    events = sorted(events, key=lambda e: e.timestamp)

    evaluations = await eval_repo.get_by_session(session_id)

    return [
        TimelineEntry(
            event=evt,
            evaluation=evaluations.get(str(evt.id)),
        )
        for evt in events
    ]


@router.post("/sessions/{session_id}/action")
async def enforce_session_action(
    session_id: uuid.UUID,
    payload: SessionActionRequest,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    tenant_id: str = Depends(get_current_tenant),
):
    """Enforce a containment action. Authorization is server-side; tenant mismatch is 404."""
    session = await _require_tenant_session(session_id, tenant_id, tracker, db)

    # Ensure tracker has the session for in-memory follow-up ingest checks
    if not tracker.get_session(session_id):
        tracker.active_sessions[str(session_id)] = session

    target_status = _ACTION_TARGET_STATUS.get(payload.action)
    if target_status and session.status == target_status:
        logger.info("Idempotent %s on session %s (already %s)", payload.action, session_id, session.status)
        return {
            "session_id": str(session_id),
            "enforced_action": payload.action,
            "status": session.status,
            "idempotent": True,
        }

    if payload.action == "DEPLOY_MITIGATION":
        return await deploy_session_mitigation(
            session_id=session_id,
            payload=SessionMitigateRequest(rule_name=f"Mitigate: {payload.tool_name or 'operator'}"),
            db=db,
            tracker=tracker,
            tenant_id=tenant_id,
        )

    tracker.apply_action(session_id, payload.action, payload.tool_name)
    repo = SessionRepository(db)
    updated = await repo.apply_action(session_id, payload.action)
    final = updated or tracker.get_session(session_id) or session
    event_id = str(uuid.uuid4())
    trace_id = str(uuid.uuid4())

    telemetry_bus.publish(
        {
            "type": "session_action",
            "event_id": event_id,
            "trace_id": trace_id,
            "session_id": str(session_id),
            "tenant_id": tenant_id,
            "agent_id": final.agent_id,
            "action": payload.action,
            "tool_name": payload.tool_name,
            "session_status": final.status,
            "risk_score": final.max_risk_score,
            "verdict": "BREACHED" if payload.action == "KILL" else "SUSPICIOUS",
            "severity": "CRITICAL" if payload.action == "KILL" else "HIGH",
            "flags": ["manual_containment"],
            "hmac_state": "unwired",
            "hmac_verified": None,
            "actor": tenant_id,
            "result": final.status,
            "reason": "operator_containment",
        }
    )

    logger.info("Enforced action %s on session %s → %s", payload.action, session_id, final.status)

    res_body: dict[str, Any] = {
        "session_id": str(session_id),
        "enforced_action": payload.action,
        "status": final.status,
        "idempotent": False,
        "trace_id": trace_id,
        "event_id": event_id,
    }
    if payload.tool_name:
        res_body["tool_name"] = payload.tool_name
        res_body["blocked_tools"] = tracker.get_blocked_tools(session_id)
    return res_body


@router.post("/sessions/{session_id}/tools/{tool_name}/block")
async def block_session_tool(
    session_id: uuid.UUID,
    tool_name: str,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    tenant_id: str = Depends(get_current_tenant),
):
    """Granularly revoke and quarantine a specific tool for this session."""
    session = await _require_tenant_session(session_id, tenant_id, tracker, db)
    if not tracker.get_session(session_id):
        tracker.active_sessions[str(session_id)] = session

    tracker.block_tool(session_id, tool_name)
    event_id = str(uuid.uuid4())
    trace_id = str(uuid.uuid4())

    telemetry_bus.publish(
        {
            "type": "tool_quarantine",
            "event_id": event_id,
            "trace_id": trace_id,
            "session_id": str(session_id),
            "tenant_id": tenant_id,
            "agent_id": session.agent_id,
            "action": "BLOCK_TOOL",
            "tool_name": tool_name,
            "session_status": session.status,
            "verdict": "CONTAINED",
            "severity": "HIGH",
            "actor": tenant_id,
            "result": "BLOCKED",
            "reason": f"Tool '{tool_name}' quarantined by operator.",
        }
    )

    logger.info("Tool '%s' blocked on session %s by tenant %s", tool_name, session_id, tenant_id)

    return {
        "session_id": str(session_id),
        "tool_name": tool_name,
        "action": "BLOCK_TOOL",
        "status": "QUARANTINED",
        "blocked": True,
        "blocked_tools": tracker.get_blocked_tools(session_id),
        "event_id": event_id,
        "trace_id": trace_id,
    }


@router.get("/sessions/{session_id}/tools/blocked")
async def list_blocked_tools(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    tenant_id: str = Depends(get_current_tenant),
):
    """List all quarantined / blocked tools for this session."""
    await _require_tenant_session(session_id, tenant_id, tracker, db)
    return {
        "session_id": str(session_id),
        "blocked_tools": tracker.get_blocked_tools(session_id),
    }


@router.post("/sessions/{session_id}/mitigate")
async def deploy_session_mitigation(
    session_id: uuid.UUID,
    payload: SessionMitigateRequest | None = None,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    tenant_id: str = Depends(get_current_tenant),
):
    """Synthesize, snapshot, and deploy an authoritative policy mitigation rule for this session."""
    session = await _require_tenant_session(session_id, tenant_id, tracker, db)
    req = payload or SessionMitigateRequest()

    from src.api.routes.policies import _synthesize_pattern, _write_rules, list_policies

    content = req.content
    trigger_phrases = list(req.trigger_phrases)
    if not content and not trigger_phrases:
        events = tracker.session_events.get(str(session_id), [])
        if not events:
            event_repo = EventRepository(db)
            events = await event_repo.get_by_session(session_id)
        if events:
            sorted_events = sorted(events, key=lambda e: getattr(e, "timestamp", 0), reverse=True)
            latest_evt = sorted_events[0]
            from src.containment.detectors.policy import _args_text

            content = _args_text(latest_evt) if hasattr(latest_evt, "arguments") else str(latest_evt)
            if not req.rule_name:
                tool_label = getattr(latest_evt, "tool_name", None) or "session"
                req.rule_name = f"Mitigate {session.agent_id}: {tool_label}"
        else:
            content = f"mitigate_breach_{session.agent_id}"

    pattern = req.pattern or _synthesize_pattern(content or "suspicious", trigger_phrases)
    rule_name = req.rule_name or f"Mitigate {session.agent_id} Breach"

    current = await list_policies()
    rules = list(current.get("rules", []))
    new_rule = {
        "name": rule_name,
        "pattern": pattern,
        "event_type": req.event_type,
        "severity": req.severity,
        "risk_score": req.risk_score,
        "description": f"Authoritative mitigation deployed by operator for session {session_id}.",
    }
    if req.tool:
        new_rule["tool"] = req.tool.lower()

    rules.append(new_rule)
    version_meta = _write_rules(rules, trigger="operator_mitigation", note=f"Mitigation deployed on session {session_id}")

    semantic_patched = False
    if req.hot_patch_semantic and content:
        try:
            from src.containment.dynamic_semantic_registry import DynamicSemanticRegistry

            registry = DynamicSemanticRegistry.get_instance()
            registry.register_breach(
                phrase=content[:250],
                campaign_id="operator_mitigation",
                round_id=int(version_meta.get("version", 1)),
                category=req.event_type,
            )
            semantic_patched = True
        except Exception as exc:
            logger.warning("Could not hot-patch semantic registry: %s", exc)

    event_id = str(uuid.uuid4())
    trace_id = str(uuid.uuid4())

    telemetry_bus.publish(
        {
            "type": "operator_action",
            "event_id": event_id,
            "trace_id": trace_id,
            "session_id": str(session_id),
            "tenant_id": tenant_id,
            "agent_id": session.agent_id,
            "action": "DEPLOY_MITIGATION",
            "rule_name": rule_name,
            "pattern": pattern,
            "playbook_version": version_meta.get("version", 1),
            "session_status": session.status,
            "verdict": "CONTAINED",
            "severity": req.severity,
            "actor": tenant_id,
            "result": "MITIGATED",
            "reason": f"Mitigation deployed by operator: {rule_name}",
        }
    )

    logger.info("Deployed mitigation '%s' (v%s) on session %s by tenant %s", rule_name, version_meta.get("version"), session_id, tenant_id)

    return {
        "session_id": str(session_id),
        "action": "DEPLOY_MITIGATION",
        "status": "mitigation_deployed",
        "rule_name": rule_name,
        "pattern": pattern,
        "playbook_version": version_meta.get("version", 1),
        "semantic_hot_patched": semantic_patched,
        "event_id": event_id,
        "trace_id": trace_id,
    }


@router.websocket("/sessions/{session_id}/stream")
async def session_websocket_stream(websocket: WebSocket, session_id: uuid.UUID):
    """Live WebSocket telemetry stream for a specific session."""
    if await require_ws_auth(websocket) is None:
        return

    await websocket.accept()
    logger.info("WebSocket connected for session stream %s", session_id)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(
                json.dumps(
                    {
                        "session_id": str(session_id),
                        "event": "TELEMETRY_ACK",
                        "received": data,
                    }
                )
            )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session stream %s", session_id)
