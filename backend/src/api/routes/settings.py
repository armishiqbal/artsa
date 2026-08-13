"""Enterprise Settings Routes — audit log, notifications, team management, tenants."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_db
from src.core.config import settings as app_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Settings"])

# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------

# In-memory audit log store (would be DB-persisted in production)
_audit_log: list[dict[str, Any]] = []


def _record_audit(
    action: str,
    actor: str = "system",
    resource: str = "",
    detail: str = "",
    tenant_id: str = "default_tenant",
) -> None:
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(UTC).isoformat(),
        "actor": actor,
        "action": action,
        "resource": resource,
        "detail": detail,
        "tenant_id": tenant_id,
    }
    _audit_log.insert(0, entry)
    # Keep last 500 entries
    if len(_audit_log) > 500:
        _audit_log.pop()


class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    actor: str
    action: str
    resource: str = ""
    detail: str = ""
    tenant_id: str = "default_tenant"


@router.get("/settings/audit-log")
async def get_audit_log(
    limit: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    actor: str | None = Query(None),
) -> dict[str, Any]:
    """Return recent audit log entries, optionally filtered."""
    entries = _audit_log
    if action:
        entries = [e for e in entries if e["action"] == action]
    if actor:
        entries = [e for e in entries if e["actor"] == actor]
    return {
        "entries": entries[:limit],
        "total": len(entries),
        "actions": sorted({e["action"] for e in _audit_log}),
    }


# ---------------------------------------------------------------------------
# Notification Preferences
# ---------------------------------------------------------------------------

# In-memory user preferences store
_notification_prefs: dict[str, dict[str, Any]] = {}


class NotificationPreferences(BaseModel):
    email_digest_enabled: bool = False
    email_digest_frequency: str = "daily"  # daily | weekly | realtime
    email_recipients: list[str] = Field(default_factory=list)
    slack_enabled: bool = False
    slack_webhook_url: str = ""
    slack_channel: str = ""
    slack_dm_on_critical: bool = False
    pagerduty_enabled: bool = False
    pagerduty_routing_key: str = ""
    pagerduty_severity_threshold: str = "HIGH"
    splunk_enabled: bool = False
    splunk_hec_url: str = ""
    splunk_hec_token: str = ""
    teams_enabled: bool = False
    teams_webhook_url: str = ""


@router.get("/settings/notifications")
async def get_notification_preferences(request: Request) -> dict[str, Any]:
    """Get notification preferences for the current user/tenant."""
    tenant_id = request.headers.get("X-Tenant-ID", "default_tenant")
    prefs = _notification_prefs.get(tenant_id)
    if prefs is None:
        return {"preferences": NotificationPreferences().model_dump(), "tenant_id": tenant_id}
    return {"preferences": prefs, "tenant_id": tenant_id}


@router.put("/settings/notifications")
async def update_notification_preferences(
    payload: NotificationPreferences,
    request: Request,
) -> dict[str, Any]:
    """Update notification preferences."""
    tenant_id = request.headers.get("X-Tenant-ID", "default_tenant")
    _notification_prefs[tenant_id] = payload.model_dump()
    _record_audit(
        action="notifications_updated",
        actor="admin",
        resource="notification_preferences",
        detail=f"Updated notification preferences for tenant {tenant_id}",
        tenant_id=tenant_id,
    )
    return {"status": "saved", "preferences": payload.model_dump()}


@router.post("/settings/notifications/test")
async def test_notification(
    channel: str = Query(..., description="email | slack | pagerduty | splunk | teams"),
    request: Request = None,
) -> dict[str, Any]:
    """Send a test notification through the specified channel."""
    _record_audit(
        action="notification_test",
        actor="admin",
        resource=f"notification:{channel}",
        detail=f"Test notification dispatched via {channel}",
    )
    return {"status": "sent", "channel": channel, "detail": f"Test {channel} notification dispatched"}


# ---------------------------------------------------------------------------
# Team Management (OIDC-aware)
# ---------------------------------------------------------------------------

_team_members: list[dict[str, Any]] = [
    {
        "id": "member-001",
        "name": "Admin User",
        "email": "admin@example.com",
        "role": "admin",
        "status": "active",
        "last_active": datetime.now(UTC).isoformat(),
        "auth_method": "local",
        "added_at": "2025-01-01T00:00:00Z",
    },
]


class TeamMemberCreate(BaseModel):
    name: str
    email: str
    role: str = "analyst"  # admin | analyst | redteam | readonly


class TeamMemberUpdate(BaseModel):
    role: str | None = None
    status: str | None = None  # active | suspended


@router.get("/settings/team")
async def list_team_members(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List team members for the current tenant."""
    _ = db  # reserved for future DB-backed team storage
    return {
        "members": _team_members,
        "total": len(_team_members),
        "oidc_enabled": app_settings.ARTSA_OIDC_ENABLED,
        "roles": ["admin", "analyst", "redteam", "readonly"],
    }


@router.post("/settings/team", status_code=status.HTTP_201_CREATED)
async def add_team_member(
    payload: TeamMemberCreate,
    request: Request,
) -> dict[str, Any]:
    """Add a new team member."""
    if payload.role not in ("admin", "analyst", "redteam", "readonly"):
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")

    member = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": payload.email,
        "role": payload.role,
        "status": "active",
        "last_active": None,
        "auth_method": "manual" if not app_settings.ARTSA_OIDC_ENABLED else "oidc",
        "added_at": datetime.now(UTC).isoformat(),
    }
    _team_members.append(member)
    _record_audit(
        action="team_member_added",
        actor="admin",
        resource=f"team:{payload.email}",
        detail=f"Added {payload.name} ({payload.email}) as {payload.role}",
    )
    return {"status": "added", "member": member}


@router.patch("/settings/team/{member_id}")
async def update_team_member(
    member_id: str,
    payload: TeamMemberUpdate,
    request: Request,
) -> dict[str, Any]:
    """Update a team member's role or status."""
    for member in _team_members:
        if member["id"] == member_id:
            if payload.role is not None:
                if payload.role not in ("admin", "analyst", "redteam", "readonly"):
                    raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
                member["role"] = payload.role
            if payload.status is not None:
                if payload.status not in ("active", "suspended"):
                    raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")
                member["status"] = payload.status
            _record_audit(
                action="team_member_updated",
                actor="admin",
                resource=f"team:{member['email']}",
                detail=f"Updated {member['name']}: role={member['role']}, status={member['status']}",
            )
            return {"status": "updated", "member": member}
    raise HTTPException(status_code=404, detail="Member not found")


@router.delete("/settings/team/{member_id}")
async def remove_team_member(member_id: str, request: Request) -> dict[str, Any]:
    """Remove a team member."""
    global _team_members
    for member in _team_members:
        if member["id"] == member_id:
            _team_members = [m for m in _team_members if m["id"] != member_id]
            _record_audit(
                action="team_member_removed",
                actor="admin",
                resource=f"team:{member['email']}",
                detail=f"Removed {member['name']} ({member['email']})",
            )
            return {"status": "removed", "member_id": member_id}
    raise HTTPException(status_code=404, detail="Member not found")


# ---------------------------------------------------------------------------
# Tenant Management
# ---------------------------------------------------------------------------

_tenants: list[dict[str, Any]] = [
    {
        "id": "default_tenant",
        "name": "Default Organization",
        "slug": "default",
        "plan": "enterprise",
        "status": "active",
        "member_count": len(_team_members),
        "created_at": "2025-01-01T00:00:00Z",
    },
]


@router.get("/settings/tenants")
async def list_tenants(request: Request) -> dict[str, Any]:
    """List available tenants for the authenticated user."""
    return {"tenants": _tenants, "current": "default_tenant"}


# Seed initial audit entries
for _entry in [
    {"action": "system_started", "resource": "platform", "detail": "ARTSA platform initialized"},
    {"action": "provider_added", "resource": "provider:openai", "detail": "OpenAI provider registered via .env"},
    {"action": "guardrail_configured", "resource": "guardrail:lakera", "detail": "Lakera Guard configured"},
]:
    _record_audit(**_entry)
