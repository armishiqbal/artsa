"""Custom outbound integration configuration endpoints (DB-persisted).

Users define connectors to any HTTP system — method, URL, headers, auth, JSON
payload template, and event triggers — without writing code. Secrets are
encrypted at rest and never returned by the API (masked only).

Endpoints (mounted under ``/v1`` and ``/api/v1``):

- ``GET    /integrations/schema``   — event types, auth types, template fields
- ``GET    /integrations``          — list connectors (secrets masked)
- ``POST   /integrations``          — create a connector (409 on duplicate)
- ``GET    /integrations/{name}``   — one connector (secrets masked)
- ``PATCH  /integrations/{name}``   — partial update (secrets preserved)
- ``DELETE /integrations/{name}``   — remove a connector
- ``POST   /integrations/{name}/test`` — dispatch a synthetic sample event
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant
from src.data.db import get_async_session
from src.data.integration_store import (
    delete_integration,
    get_integration,
    list_integrations,
    slugify,
    upsert_integration,
)
from src.services.custom_integration_dispatcher import (
    AUTH_SECRET_NAMES,
    dispatch,
    sample_event,
)
from src.services.custom_integration_registry import (
    SUPPORTED_AUTH_TYPES,
    SUPPORTED_EVENT_TYPES,
    SUPPORTED_METHODS,
    CustomIntegration,
    custom_integration_registry,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Custom Integrations"])

_EVENT_TYPES: tuple[str, ...] = SUPPORTED_EVENT_TYPES
_AUTH_TYPES: tuple[str, ...] = SUPPORTED_AUTH_TYPES

# Template fields exposed per event type (documented in /integrations/schema).
_TEMPLATE_FIELDS: dict[str, list[str]] = {
    "alert": [
        "id",
        "session_id",
        "agent_id",
        "severity",
        "title",
        "message",
        "channel",
        "triggered_at",
        "risk_score",
        "type",
    ],
    "tool_call": [
        "type",
        "session_id",
        "agent_id",
        "tool_name",
        "risk_score",
        "verdict",
        "confidence",
        "action",
        "severity",
        "flags",
        "security_event_count",
        "detectors",
        "security_events",
        "enforced",
        "session_status",
        "timestamp",
    ],
    "proxy_call": [
        "type",
        "session_id",
        "agent_id",
        "tool_name",
        "provider",
        "model",
        "stream",
        "action",
        "risk_score",
        "verdict",
        "flags",
        "severity",
        "latency_ms",
        "timestamp",
    ],
    "session_action": [
        "type",
        "session_id",
        "agent_id",
        "action",
        "session_status",
        "risk_score",
        "verdict",
        "severity",
        "flags",
        "timestamp",
    ],
}


class IntegrationPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, description="Connector slug")
    description: str | None = Field(default=None, max_length=512)
    method: Literal["POST", "PUT", "PATCH"] = "POST"
    target_url: str = Field(..., min_length=1, description="Target endpoint URL")
    auth_type: Literal["none", "bearer", "basic", "api_key"] = "none"
    headers: dict[str, str] = Field(default_factory=dict, description="Custom headers; values may embed {{secret:name}}")
    payload_template: str | None = Field(
        default=None, description="JSON body template with {{field}} placeholders; null = full default payload"
    )
    event_types: list[Literal["alert", "tool_call", "proxy_call", "session_action"]] = ["alert"]
    risk_threshold: float = Field(default=0.0, ge=0, le=100)
    enabled: bool = True
    retries: int = Field(default=3, ge=0, le=10)
    timeout: float = Field(default=10.0, gt=0, le=120)
    secrets: dict[str, str] = Field(default_factory=dict, description="Plaintext secrets, encrypted at rest")


class IntegrationPatch(BaseModel):
    """Partial update — any field may be omitted; unmentioned secrets survive."""

    description: str | None = Field(default=None, max_length=512)
    method: Literal["POST", "PUT", "PATCH"] | None = None
    target_url: str | None = Field(default=None, min_length=1)
    auth_type: Literal["none", "bearer", "basic", "api_key"] | None = None
    headers: dict[str, str] | None = None
    payload_template: str | None = None  # explicit "" clears the template
    event_types: list[Literal["alert", "tool_call", "proxy_call", "session_action"]] | None = None
    risk_threshold: float | None = Field(default=None, ge=0, le=100)
    enabled: bool | None = None
    retries: int | None = Field(default=None, ge=0, le=10)
    timeout: float | None = Field(default=None, gt=0, le=120)
    secrets: dict[str, str] | None = Field(default=None, description="Merge; empty string value deletes a secret")


def _validate_payload_template(template: str | None) -> None:
    if not template or not template.strip():
        return
    try:
        json.loads(template)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"payload_template must be valid JSON: {exc.msg}",
        ) from exc


async def _refresh_registry() -> None:
    try:
        await custom_integration_registry.refresh()
    except Exception as exc:  # pragma: no cover
        logger.warning("Custom integration registry refresh failed: %s", exc)


@router.get("/integrations/schema")
async def integrations_schema() -> dict[str, Any]:
    """Advertise event types, auth types, methods, and template field reference."""
    return {
        "event_types": list(_EVENT_TYPES),
        "methods": list(SUPPORTED_METHODS),
        "auth_types": [
            {
                "type": auth,
                "secrets": list(AUTH_SECRET_NAMES.get(auth, ())),
                "header": _auth_header_preview(auth),
            }
            for auth in _AUTH_TYPES
        ],
        "template_fields": _TEMPLATE_FIELDS,
        "placeholder_syntax": {
            "field": "{{field}} or {{a.b.0.c}} — dotted path into the event payload",
            "secret": "{{secret:name}} — resolves from the connector's encrypted secret store",
        },
    }


def _auth_header_preview(auth_type: str) -> str | None:
    if auth_type == "bearer":
        return "Authorization: Bearer {{secret:token}}"
    if auth_type == "api_key":
        return "X-API-Key: {{secret:api_key}}"
    if auth_type == "basic":
        return "Authorization: Basic base64(username:password)"
    return None


@router.get("/integrations")
async def integrations_list(
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """List user-defined connectors. Secrets are never returned (masked)."""
    rows = await list_integrations(session, tenant_id=tenant_id)
    return {"integrations": rows, "total": len(rows)}


@router.post("/integrations", status_code=201)
async def integrations_create(
    payload: IntegrationPayload,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Create a connector (409 if the slug already exists in this tenant)."""
    _validate_payload_template(payload.payload_template)
    existing = await get_integration(
        session, slugify(payload.name), include_secrets=True, tenant_id=tenant_id
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"integration '{slugify(payload.name)}' already exists",
        )
    try:
        row = await upsert_integration(
            session,
            name=payload.name,
            description=payload.description,
            method=payload.method,
            target_url=payload.target_url,
            auth_type=payload.auth_type,
            headers=payload.headers,
            payload_template=payload.payload_template,
            event_types=list(payload.event_types),
            risk_threshold=payload.risk_threshold,
            enabled=payload.enabled,
            retries=payload.retries,
            timeout=payload.timeout,
            secrets=payload.secrets,
            tenant_id=tenant_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await _refresh_registry()
    return {"status": "ok", "integration": row}


@router.get("/integrations/{name}")
async def integrations_get(
    name: str,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Fetch one connector (secrets masked)."""
    # include_secrets must stay False here — the store defaults to True for the
    # internal PATCH/test merge paths; GET must never return plaintext secrets.
    row = await get_integration(
        session, slugify(name), include_secrets=False, tenant_id=tenant_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"integration '{slugify(name)}' not found")
    return {"integration": row}


@router.patch("/integrations/{name}")
async def integrations_patch(
    name: str,
    payload: IntegrationPatch,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Partially update a connector; unmentioned secrets are preserved."""
    _validate_payload_template(payload.payload_template)
    existing = await get_integration(
        session, slugify(name), include_secrets=True, tenant_id=tenant_id
    )
    if existing is None:
        raise HTTPException(status_code=404, detail=f"integration '{slugify(name)}' not found")

    updates = payload.model_dump(exclude_unset=True)
    incoming_secrets = updates.pop("secrets", None)

    # Merge secrets: overlay provided plaintext; empty string deletes a secret.
    merged_secrets: dict[str, str] = dict(existing.get("secrets") or {})
    if incoming_secrets is not None:
        for secret_name, value in incoming_secrets.items():
            if value == "":
                merged_secrets.pop(secret_name, None)
            else:
                merged_secrets[secret_name] = value

    merged = {k: existing.get(k) for k in IntegrationPayload.model_fields.keys() - {"name"}}
    merged.update({k: v for k, v in updates.items() if k in merged})
    merged["name"] = existing["name"]
    merged["secrets"] = merged_secrets

    try:
        row = await upsert_integration(session, tenant_id=tenant_id, **merged)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await _refresh_registry()
    return {"status": "ok", "integration": row}


@router.delete("/integrations/{name}")
async def integrations_delete(
    name: str,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Remove a connector belonging to the calling tenant."""
    removed = await delete_integration(session, slugify(name), tenant_id=tenant_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"integration '{slugify(name)}' not found")
    await _refresh_registry()
    return {"status": "deleted", "name": slugify(name)}


@router.post("/integrations/{name}/test")
async def integrations_test(
    name: str,
    payload: dict[str, Any] = Body(default={}),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Dispatch a synthetic sample event through the connector (disabled ones included).

    Never raises on upstream failure and never returns secrets.
    """
    row = await get_integration(session, slugify(name), include_secrets=True)
    if row is None:
        raise HTTPException(status_code=404, detail=f"integration '{slugify(name)}' not found")

    event_type = str(payload.get("event_type") or "alert")
    if event_type not in _EVENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"event_type must be one of: {', '.join(_EVENT_TYPES)}",
        )

    integration = CustomIntegration(
        name=row["name"],
        target_url=row["target_url"],
        method=row["method"],
        description=row["description"],
        auth_type=row["auth_type"],
        headers=row["headers"],
        payload_template=row["payload_template"],
        event_types=row["event_types"],
        risk_threshold=row["risk_threshold"],
        enabled=row["enabled"],
        retries=row["retries"],
        timeout=row["timeout"],
        secrets=row.get("secrets") or {},
    )
    # Run the (sync, retrying) HTTP call off the event loop.
    delivered = await asyncio.to_thread(dispatch, integration, event_type, sample_event(event_type))
    return {
        "status": "sent" if delivered else "failed",
        "event_type": event_type,
        "detail": "" if delivered else "upstream rejected or unreachable",
    }
