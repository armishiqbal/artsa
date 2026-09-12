"""Privacy-preserving primitives for the AI Security Playground."""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import UTC, datetime, timedelta
from datetime import time as dt_time
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.orm import PlaygroundRunAuditORM
from src.runtime.actions import RuntimeAction
from src.runtime.evidence import RedactedFinding


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def action_for_verdict(verdict: str) -> RuntimeAction:
    if verdict == "BREACHED":
        return RuntimeAction.BLOCK
    if verdict == "SUSPICIOUS":
        return RuntimeAction.QUARANTINE
    return RuntimeAction.ALLOW


def public_findings(findings: list[Any]) -> list[dict[str, Any]]:
    """Return classification metadata only; never source text or evidence."""
    result: list[dict[str, Any]] = []
    for item in findings:
        if isinstance(item, RedactedFinding):
            result.append(
                {
                    "detector": item.detector,
                    "category": item.category,
                    "action": item.action.value,
                    "span_start": item.span_start,
                    "span_end": item.span_end,
                    "match_length": item.match_length,
                }
            )
        elif isinstance(item, dict):
            result.append(
                {
                    "detector": item.get("detector", "unknown"),
                    "category": item.get("category", item.get("event_type", "unknown")),
                    "action": item.get("action"),
                }
            )
        else:
            result.append(
                {
                    "detector": getattr(item, "detector", "unknown"),
                    "category": getattr(item, "category", getattr(item, "event_type", "unknown")),
                    "action": getattr(getattr(item, "action", None), "value", None),
                }
            )
    return result


def budget_snapshot(redis: Any | None, *, tenant_id: str) -> dict[str, int]:
    """Expose only remaining numeric allowance; never expose quota contents."""
    now = datetime.now(UTC)
    day = now.strftime("%Y%m%d")
    used_requests = 0
    used_tokens = 0
    try:
        if redis is not None and hasattr(redis, "get"):
            used_requests = int(redis.get(f"artsa:playground:requests:{tenant_id}:{day}") or 0)
            used_tokens = int(redis.get(f"artsa:playground:tokens:{tenant_id}:{day}") or 0)
    except Exception:
        # A catalog may still render provider metadata; the run path remains
        # fail-closed when it cannot reserve quota.
        used_requests = used_tokens = 0
    return {
        "daily_requests": settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS,
        "daily_tokens": settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS,
        "remaining_requests": max(0, settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS - used_requests) if settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS > 0 else 0,
        "remaining_tokens": max(0, settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS - used_tokens) if settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS > 0 else 0,
        "max_output_tokens": settings.ARTSA_PLAYGROUND_MAX_OUTPUT_TOKENS,
    }


def redact_prompt_scan(scan: Any, *, channel: str) -> dict[str, Any]:
    """Convert PromptScanner output to a response that cannot echo submitted text."""
    return {
        "channel": channel,
        "body_sha256": digest(scan.content),
        "risk_score": scan.risk.overall_score,
        "risk_breakdown": {
            "rule_based": scan.risk.rule_based_score,
            "statistical": scan.risk.statistical_score,
            "semantic": scan.risk.semantic_score,
            "goal_drift": scan.risk.goal_drift_score,
        },
        "layer_scores": scan.layer_scores,
        "flags": list(scan.risk.flags),
        "verdict": scan.verdict.verdict,
        "confidence": scan.verdict.confidence,
        "recommended_action": scan.verdict.recommended_action,
        "fired_detectors": scan.fired_detectors,
        "findings": public_findings(scan.security_events),
        # Spans are useful to the browser, which already owns the text, while
        # never reflecting trigger phrases back through the API.
        "highlights": [{"start": h.start, "end": h.end} for h in scan.highlights],
    }


async def enforce_chat_budget(
    db: AsyncSession,
    *,
    tenant_id: str,
    actor_id: str | None,
    redis: Any | None = None,
    estimated_input_tokens: int = 0,
) -> None:
    """Reserve a chat request before any provider call.

    Redis counters are the cross-process admission control.  The SQL query is
    retained as a recovery/verification path for environments without Redis;
    production refuses to continue when the atomic counter is unavailable.
    """
    from fastapi import HTTPException, status

    now = datetime.now(UTC)
    # RPM is a fixed rolling bucket; tenant quotas use the UTC calendar day so
    # operators can reconcile them with billing and the catalog response.
    # In-memory Redis is useful for local tests, but cannot provide the
    # cross-process quota boundary required in production.  The dependency
    # normally refuses to construct it there; keep this guard for overrides
    # and partially initialized workers as well.
    if settings.ENVIRONMENT == "production" and (
        redis is None
        or not hasattr(redis, "incr_with_expiry")
        or getattr(redis, "is_live", True) is False
    ):
        raise HTTPException(status_code=503, detail="playground_quota_unavailable")
    if redis is not None and hasattr(redis, "incr_with_expiry"):
        try:
            if settings.ARTSA_PLAYGROUND_USER_RPM > 0 and actor_id:
                user_key = f"artsa:playground:rpm:{tenant_id}:{actor_id}:{now.strftime('%Y%m%d%H%M')}"
                user_count = redis.incr_with_expiry(user_key, 61)
                if user_count > settings.ARTSA_PLAYGROUND_USER_RPM:
                    raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="playground_user_rate_limit_exhausted")
            day = now.strftime("%Y%m%d")
            ttl = max(60, int((datetime.combine(now.date() + timedelta(days=1), dt_time.min, tzinfo=UTC) - now).total_seconds()))
            request_count = redis.incr_with_expiry(f"artsa:playground:requests:{tenant_id}:{day}", ttl)
            if settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS > 0 and request_count > settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="playground_tenant_request_budget_exhausted")
            reserved_tokens = max(0, int(estimated_input_tokens)) + max(0, int(settings.ARTSA_PLAYGROUND_MAX_OUTPUT_TOKENS))
            token_count = redis.incr_with_expiry(f"artsa:playground:tokens:{tenant_id}:{day}", ttl) if reserved_tokens else 0
            if settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS > 0 and token_count > settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="playground_tenant_token_budget_exhausted")
            return
        except HTTPException:
            raise
        except Exception as exc:
            if settings.ENVIRONMENT == "production":
                raise HTTPException(status_code=503, detail="playground_quota_unavailable") from exc

    if not hasattr(db, "execute"):
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=503, detail="playground_quota_unavailable")
        return
    since = datetime.combine(now.date(), dt_time.min, tzinfo=UTC)
    try:
        result = await db.execute(
            select(
                func.count(PlaygroundRunAuditORM.id),
                func.coalesce(func.sum(PlaygroundRunAuditORM.input_tokens + PlaygroundRunAuditORM.output_tokens), 0),
            ).where(
                PlaygroundRunAuditORM.tenant_id == tenant_id,
                PlaygroundRunAuditORM.channel == "chat",
                PlaygroundRunAuditORM.created_at >= since,
            )
        )
    except Exception as exc:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=503, detail="playground_quota_unavailable") from exc
        return
    try:
        requests, tokens = result.one()
    except Exception as exc:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=503, detail="playground_quota_unavailable") from exc
        return
    if settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS > 0 and int(requests or 0) >= settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="playground_tenant_request_budget_exhausted")
    if settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS > 0 and int(tokens or 0) >= settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="playground_tenant_token_budget_exhausted")


async def record_run(
    db: AsyncSession,
    *,
    tenant_id: str,
    actor_id: str | None,
    session_id: uuid.UUID,
    mode: str,
    channel: str,
    request_body: str,
    response_body: str | None,
    action: RuntimeAction | str,
    findings: list[Any],
    provider_id: str | None = None,
    model: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    estimated_tokens: bool = False,
    started_at: float | None = None,
) -> None:
    """Append a row containing only digests and redacted detector metadata."""
    db.add(
        PlaygroundRunAuditORM(
            id=str(uuid.uuid4()), tenant_id=tenant_id, actor_id=actor_id,
            session_id=str(session_id), mode=mode, channel=channel,
            provider_id=provider_id, model=model, request_sha256=digest(request_body),
            response_sha256=digest(response_body) if response_body is not None else None,
            action=action.value if isinstance(action, RuntimeAction) else str(action),
            findings=public_findings(findings), input_tokens=input_tokens,
            output_tokens=output_tokens, estimated_tokens=estimated_tokens,
            latency_ms=max(0, int((time.monotonic() - started_at) * 1000)) if started_at else 0,
        )
    )
