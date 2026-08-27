"""Situation evaluate — classify free text, then score (and optionally persist).

Phase 1: dry-run classify + containment score.
Phase 2: optional LLM refine + persist to sessions/logs via ingest pipeline.
"""

from __future__ import annotations

import uuid
from typing import Any

from src.core.models.events import ToolCallEvent
from src.services.event_processor import EventProcessor
from src.services.situation_classifier import classify_situation


class SituationEvaluator:
    def __init__(self, processor: EventProcessor | None = None) -> None:
        self._processor = processor or EventProcessor()

    def evaluate(
        self,
        message: str,
        *,
        agent_id: str | None = None,
        session_id: str | None = None,
        use_llm: bool = False,
    ) -> dict[str, Any]:
        """Classify then score without writing to DB."""
        classification = classify_situation(message, agent_id=agent_id, use_llm=use_llm)

        try:
            sid = uuid.UUID(session_id) if session_id else uuid.uuid4()
        except (ValueError, TypeError):
            sid = uuid.uuid4()

        event = ToolCallEvent(
            session_id=sid,
            agent_id=classification.agent_id,
            tool_name=classification.tool_name,
            arguments=classification.arguments,
        )
        risk, verdict, sec_events = self._processor.process(event)

        return {
            "phase": 2,
            "mode": "situation_auto",
            "persisted": False,
            "classification": classification.to_dict(),
            "ingest_event": {
                "session_id": str(sid),
                "agent_id": classification.agent_id,
                "tool_name": classification.tool_name,
                "arguments": classification.arguments,
            },
            "risk_score": {
                "overall_score": risk.overall_score,
                "flags": risk.flags,
            },
            "verdict": {
                "verdict": verdict.verdict,
                "confidence": verdict.confidence,
                "recommended_action": verdict.recommended_action,
                "reasoning": verdict.reasoning,
            },
            "security_events": [
                {
                    "event_type": e.event_type,
                    "severity": e.severity,
                    "risk_score": e.risk_score,
                    "description": e.description,
                    "detector": e.detector,
                }
                for e in sec_events
            ],
            "logs_href": f"/logs?session={sid}",
            "note": (
                "Dry-run: scored with containment engine. "
                "Set persist=true to write this session to Logs like POST /ingest."
            ),
        }

    async def evaluate_and_persist(
        self,
        message: str,
        *,
        tenant_id: str,
        db: Any,
        redis: Any,
        tracker: Any,
        agent_id: str | None = None,
        session_id: str | None = None,
        use_llm: bool = False,
        processor: EventProcessor | None = None,
    ) -> dict[str, Any]:
        """Classify, then persist through the real ingest pipeline."""
        from src.services.ingest_pipeline import run_ingest_pipeline

        classification = classify_situation(message, agent_id=agent_id, use_llm=use_llm)
        try:
            sid = uuid.UUID(session_id) if session_id else uuid.uuid4()
        except (ValueError, TypeError):
            sid = uuid.uuid4()

        event = ToolCallEvent(
            session_id=sid,
            agent_id=classification.agent_id,
            tool_name=classification.tool_name,
            arguments=classification.arguments,
        )
        proc = processor or self._processor
        ingest = await run_ingest_pipeline(
            [event],
            tenant_id=tenant_id,
            db=db,
            redis=redis,
            processor=proc,
            tracker=tracker,
        )

        return {
            "phase": 2,
            "mode": "situation_auto",
            "persisted": True,
            "classification": classification.to_dict(),
            "ingest_event": {
                "session_id": str(sid),
                "agent_id": classification.agent_id,
                "tool_name": classification.tool_name,
                "arguments": classification.arguments,
            },
            "risk_score": ingest["risk_score"],
            "verdict": ingest["verdict"],
            "evaluations": ingest.get("evaluations", []),
            "session_status": ingest.get("session_status"),
            "auto_enforced_action": ingest.get("auto_enforced_action"),
            "security_events": [],
            "logs_href": f"/logs?session={sid}",
            "note": (
                "Persisted: same path as POST /ingest — session, telemetry, and logs updated. "
                f"Open {ingest.get('session_id')} in Logs."
            ),
        }


_evaluator: SituationEvaluator | None = None


def get_situation_evaluator() -> SituationEvaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = SituationEvaluator()
    return _evaluator
