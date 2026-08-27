"""Situation API — paste a message; ARTSA classifies tool/agent and scores it."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import (
    get_current_tenant,
    get_db,
    get_event_processor,
    get_redis,
    get_session_tracker,
)
from src.services.endpoint_quota import enforce_situation_quota
from src.services.event_processor import EventProcessor
from src.services.ingest_pipeline import ContainedSessionError
from src.services.session_tracker import SessionTracker
from src.services.situation_classifier import classify_situation
from src.services.situation_evaluator import get_situation_evaluator

router = APIRouter(tags=["Situations"])


class SituationEvaluateRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Free-text user / attacker message")
    agent_id: str | None = Field(
        default=None,
        description="Optional override; otherwise chosen from situation rules",
    )
    session_id: str | None = Field(default=None, description="Optional UUID for correlation")
    persist: bool = Field(
        default=False,
        description="Phase 2: write to sessions/logs via the real ingest pipeline",
    )
    use_llm: bool = Field(
        default=False,
        description="Phase 2: refine low-confidence classifications with LLM when available",
    )


@router.post("/situations/evaluate")
async def situations_evaluate(
    payload: SituationEvaluateRequest,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    processor: EventProcessor = Depends(get_event_processor),
    tracker: SessionTracker = Depends(get_session_tracker),
) -> dict[str, Any]:
    """Auto-classify a free-text message into a tool call, then run containment scoring.

    Dry-run by default. With ``persist=true``, writes the same artifacts as ``POST /ingest``.
    """
    enforce_situation_quota(tenant_id, use_llm=payload.use_llm)
    evaluator = get_situation_evaluator()
    if not payload.persist:
        return evaluator.evaluate(
            payload.message,
            agent_id=payload.agent_id,
            session_id=payload.session_id,
            use_llm=payload.use_llm,
        )

    try:
        return await evaluator.evaluate_and_persist(
            payload.message,
            tenant_id=tenant_id,
            db=db,
            redis=redis,
            tracker=tracker,
            agent_id=payload.agent_id,
            session_id=payload.session_id,
            use_llm=payload.use_llm,
            processor=processor,
        )
    except ContainedSessionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Session is contained — further tool calls rejected",
                "session_id": exc.session_id,
                "session_status": exc.session_status,
            },
        ) from exc


@router.post("/situations/classify")
async def situations_classify(
    payload: SituationEvaluateRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Classify only — returns suggested ingest payload without scoring."""
    enforce_situation_quota(tenant_id, use_llm=payload.use_llm)
    classification = classify_situation(
        payload.message,
        agent_id=payload.agent_id,
        use_llm=payload.use_llm,
    )
    return {
        "phase": 2,
        "classification": classification.to_dict(),
        "ingest_event": {
            "agent_id": classification.agent_id,
            "tool_name": classification.tool_name,
            "arguments": classification.arguments,
        },
    }
