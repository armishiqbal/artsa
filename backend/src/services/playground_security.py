"""Privacy-preserving primitives for the AI Security Playground."""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import UTC, datetime, timedelta
from datetime import time as dt_time
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.orm import PlaygroundRunAuditORM
from src.runtime.actions import RuntimeAction
from src.runtime.evidence import RedactedFinding

GuardCategory = Literal[
    "content_violation",
    "data_leakage",
    "prompt_attack",
    "unknown_links",
]

_GUARD_CATEGORIES: tuple[GuardCategory, ...] = (
    "content_violation",
    "data_leakage",
    "prompt_attack",
    "unknown_links",
)
_CATEGORY_LABELS: dict[GuardCategory, str] = {
    "content_violation": "Content Violation",
    "data_leakage": "Data Leakage",
    "prompt_attack": "Prompt Attack",
    "unknown_links": "Unknown Links",
}


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


def _finding_text(finding: Any) -> str:
    if isinstance(finding, dict):
        values = (
            finding.get("detector"),
            finding.get("category"),
            finding.get("event_type"),
        )
    else:
        values = (
            getattr(finding, "detector", None),
            getattr(finding, "category", None),
            getattr(finding, "event_type", None),
        )
    return " ".join(str(value or "") for value in values).lower()


def _category_for_finding(finding: Any) -> GuardCategory | None:
    text = _finding_text(finding)
    if any(token in text for token in ("prompt", "injection", "jailbreak", "instruction", "goal_drift")):
        return "prompt_attack"
    if any(token in text for token in ("secret", "credential", "pii", "leak", "exfil", "disclosure", "canary", "sensitive", "data")):
        return "data_leakage"
    if any(token in text for token in ("content", "safety", "policy", "harm", "violence", "hate", "sexual", "abuse")):
        return "content_violation"
    return None


def _finding_action(finding: Any, fallback: str) -> str:
    value = finding.get("action") if isinstance(finding, dict) else getattr(finding, "action", None)
    value = getattr(value, "value", value)
    return str(value or fallback).upper()


def output_risk_score(decision: Any) -> float:
    """Calculate output assessment risk score from the output decision."""
    action = getattr(decision, "action", None)
    action_val = action.value if hasattr(action, "value") else str(action or "").upper()
    if action_val == "BLOCK":
        return 100.0
    if action_val == "QUARANTINE":
        return 70.0
    return 0.0


def guard_assessment(
    *,
    run_id: str,
    session_id: uuid.UUID | str,
    phase: Literal["input", "output"],
    action: RuntimeAction | str,
    findings: list[Any],
    risk_score: float | None = None,
    confidence: float | None = None,
    outcome: Literal["passed", "flagged", "approval", "unavailable", "cancelled"] | None = None,
    evaluated: bool = True,
) -> dict[str, Any]:
    """Build the versioned, redacted browser assessment contract.

    Category status is decided on the server from detector metadata.  Submitted
    text, matched evidence, digests, and spans are deliberately excluded.
    """
    action_value = action.value if isinstance(action, RuntimeAction) else str(action).upper()
    scanner_unavailable = any("unavailable" in _finding_text(item) for item in findings)
    if outcome is None:
        outcome = (
            "unavailable" if action_value == "UNAVAILABLE" or scanner_unavailable
            else "approval" if action_value == RuntimeAction.QUARANTINE.value
            else "flagged" if action_value == RuntimeAction.BLOCK.value
            else "passed"
        )
    can_report = evaluated and outcome not in {"unavailable", "cancelled"} and not scanner_unavailable
    grouped: dict[GuardCategory, list[Any]] = {category: [] for category in _GUARD_CATEGORIES}
    unmapped: list[Any] = []
    for finding in findings:
        category = _category_for_finding(finding)
        if category is None:
            unmapped.append(finding)
        else:
            grouped[category].append(finding)
    # A blocking detector with a new/unknown category must never produce an
    # all-green assessment. Conservatively surface it as a content violation.
    if unmapped and action_value in {RuntimeAction.BLOCK.value, RuntimeAction.QUARANTINE.value}:
        grouped["content_violation"].extend(unmapped)

    categories: list[dict[str, Any]] = []
    for category in _GUARD_CATEGORIES:
        matches = grouped[category]
        label = _CATEGORY_LABELS[category]
        if category == "unknown_links":
            status = "not_evaluated"
            category_action = None
            explanation = "Not supported"
        elif not can_report:
            status = "not_evaluated"
            category_action = None
            explanation = f"{label} was not evaluated for this run."
        elif matches:
            status = "detected"
            match_actions = [_finding_action(item, action_value) for item in matches]
            category_action = (
                "BLOCK" if "BLOCK" in match_actions
                else "QUARANTINE" if "QUARANTINE" in match_actions
                else action_value if action_value in {"BLOCK", "QUARANTINE"}
                else "ALLOW"
            )
            explanation = f"{label} was detected by {len(matches)} enabled detector{'s' if len(matches) != 1 else ''}."
        else:
            status = "not_detected"
            category_action = "ALLOW"
            explanation = f"No enabled {label.lower()} detector matched."
        categories.append(
            {
                "category": category,
                "status": status,
                "confidence": float(confidence) if matches and confidence is not None and can_report else None,
                "action": category_action,
                "detectorCount": len(matches) if can_report else 0,
                "explanation": explanation,
            }
        )

    return {
        "schemaVersion": 1,
        "runId": run_id,
        "sessionId": str(session_id),
        "phase": phase,
        "outcome": outcome,
        "action": action_value if action_value in {"ALLOW", "BLOCK", "QUARANTINE", "UNAVAILABLE"} else "UNAVAILABLE",
        "riskScore": float(risk_score) if risk_score is not None and can_report else None,
        "categories": categories,
    }


def unavailable_guard_assessment(
    *, run_id: str, session_id: uuid.UUID | str, phase: Literal["input", "output"] = "output"
) -> dict[str, Any]:
    return guard_assessment(
        run_id=run_id,
        session_id=session_id,
        phase=phase,
        action="UNAVAILABLE",
        findings=[],
        outcome="unavailable",
        evaluated=False,
    )


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
            token_count = (
                redis.incr_by_with_expiry(
                    f"artsa:playground:tokens:{tenant_id}:{day}", reserved_tokens, ttl
                )
                if reserved_tokens
                else 0
            )
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
