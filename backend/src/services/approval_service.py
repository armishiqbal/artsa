"""Digest-bound, one-time approval request helpers."""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.orm import ApprovalRequestORM


def operation_digest(session_id: uuid.UUID, tool_name: str, arguments: dict[str, Any]) -> str:
    body = json.dumps(
        {"session_id": str(session_id), "tool_name": tool_name, "arguments": arguments},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(body.encode()).hexdigest()


def approval_binding_digest(
    session_id: uuid.UUID,
    tool_name: str,
    arguments: dict[str, Any],
    binding_context: dict[str, str] | None = None,
) -> str:
    """Digest an approval's complete authority scope without retaining inputs.

    Legacy callers retain the original operation-only binding.  Managed MCP
    actions pass their installation, repository and policy version so an
    approval cannot be replayed against a different authority boundary.
    """
    if not binding_context:
        return operation_digest(session_id, tool_name, arguments)
    body = json.dumps(
        {
            "operation_sha256": operation_digest(session_id, tool_name, arguments),
            "binding_context": binding_context,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(body.encode()).hexdigest()


def redacted_findings(events: list[Any]) -> list[dict[str, Any]]:
    # Both ingest SecurityEvent and runtime RedactedFinding are accepted.  The
    # resulting shape intentionally contains classification metadata only.
    return [
        {
            "detector": getattr(e, "detector", "unknown"),
            "category": getattr(e, "category", getattr(e, "event_type", "unknown")),
            "severity": getattr(e, "severity", None),
            "risk_score": getattr(e, "risk_score", None),
            "action": getattr(getattr(e, "action", None), "value", getattr(e, "action", None)),
        }
        for e in events
    ]


async def create_request(
    db: AsyncSession, *, tenant_id: str, session_id: uuid.UUID, tool_name: str,
    arguments: dict[str, Any], findings: list[Any], requester: dict[str, Any],
    binding_context: dict[str, str] | None = None,
) -> ApprovalRequestORM:
    now = datetime.now(UTC)
    digest = approval_binding_digest(session_id, tool_name, arguments, binding_context)
    # Do not let repeated delivery of the same blocked event turn into an
    # unbounded operator queue.  The operation itself is never persisted.
    existing = None
    if hasattr(db, "execute"):
        existing = (await db.execute(select(ApprovalRequestORM).where(
            ApprovalRequestORM.tenant_id == tenant_id,
            ApprovalRequestORM.session_id == str(session_id),
            ApprovalRequestORM.operation_sha256 == digest,
            ApprovalRequestORM.status == "PENDING",
            ApprovalRequestORM.expires_at > now,
        ))).scalar_one_or_none()
    if existing is not None:
        return existing
    row = ApprovalRequestORM(
        id=str(uuid.uuid4()), tenant_id=tenant_id, session_id=str(session_id),
        operation_sha256=digest, tool_name=tool_name,
        action="QUARANTINE", findings=redacted_findings(findings), requester=requester,
        status="PENDING", expires_at=now + timedelta(seconds=max(1, settings.ARTSA_APPROVAL_TTL_SECONDS)),
    )
    db.add(row)
    await db.flush()
    return row


def as_utc(value: datetime) -> datetime:
    """SQLite DateTime(timezone=True) still round-trips naive values."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def expire_request(db: AsyncSession, row: ApprovalRequestORM) -> bool:
    """Mark a pending row expired.  The caller applies session containment."""
    if row.status != "PENDING" or as_utc(row.expires_at) > datetime.now(UTC):
        return False
    row.status = "EXPIRED"
    row.decision_at = datetime.now(UTC)
    return True


async def get_request(db: AsyncSession, approval_id: str, tenant_id: str) -> ApprovalRequestORM | None:
    result = await db.execute(select(ApprovalRequestORM).where(
        ApprovalRequestORM.id == approval_id, ApprovalRequestORM.tenant_id == tenant_id
    ))
    return result.scalar_one_or_none()


def approval_view(row: ApprovalRequestORM) -> dict[str, Any]:
    return {
        "id": row.id, "tenant_id": row.tenant_id, "session_id": row.session_id,
        "operation_sha256": row.operation_sha256, "tool_name": row.tool_name, "action": row.action,
        "findings": row.findings or [], "status": row.status, "approver": row.approver,
        "decision_at": row.decision_at.isoformat() if row.decision_at else None,
        "expires_at": row.expires_at.isoformat(), "created_at": row.created_at.isoformat(),
    }


def issue_retry_token(redis: Any, row: ApprovalRequestORM) -> str:
    token = secrets.token_urlsafe(32)
    ttl = max(1, int((as_utc(row.expires_at) - datetime.now(UTC)).total_seconds()))
    redis.set(
        f"artsa:approval:retry:{token}",
        json.dumps({"approval_id": row.id, "tenant_id": row.tenant_id, "session_id": row.session_id,
                    "operation_sha256": row.operation_sha256}), ttl_sec=ttl,
    )
    return token


def consume_retry_token(redis: Any, token: str, *, tenant_id: str, session_id: uuid.UUID,
                        tool_name: str, arguments: dict[str, Any],
                        binding_context: dict[str, str] | None = None) -> bool:
    return consume_retry_token_approval_id(
        redis, token, tenant_id=tenant_id, session_id=session_id, tool_name=tool_name,
        arguments=arguments, binding_context=binding_context,
    ) is not None


def consume_retry_token_approval_id(
    redis: Any, token: str, *, tenant_id: str, session_id: uuid.UUID,
    tool_name: str, arguments: dict[str, Any],
    binding_context: dict[str, str] | None = None,
) -> str | None:
    """Consume a retry token and return its approval ID exactly once."""
    raw = redis.get(f"artsa:approval:retry:{token}")
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if data.get("tenant_id") != tenant_id or data.get("session_id") != str(session_id):
        return None
    if data.get("operation_sha256") != approval_binding_digest(
        session_id, tool_name, arguments, binding_context
    ):
        return None
    # Atomic consumption works across API processes; leave no reusable token.
    if not redis.set_nx(f"artsa:approval:used:{token}", "1", 900):
        return None
    approval_id = data.get("approval_id")
    return approval_id if isinstance(approval_id, str) and approval_id else None
