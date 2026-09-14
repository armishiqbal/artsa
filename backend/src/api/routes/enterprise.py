"""Enterprise integration routes — MCP proxy inspection and OTEL trace ingest."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db, get_redis
from src.core.config import settings
from src.data.orm import GitHubInstallationORM, GitHubRepositoryORM, MCPActionEvidenceORM
from src.services.github_connector import verify_github_webhook_signature
from src.services.github_execution import GitHubExecutionCoordinator
from src.services.github_inventory import (
    installation_view,
    project_signed_github_webhook,
    repository_view,
)
from src.services.mcp_gateway import GatewayActionInput, MCPRuntimeGateway
from src.services.mcp_proxy import MCPJsonRpcRequest, MCPProxyInterceptor
from src.services.otel_ingest import OTELTraceIngestor, OTELTracePayload

router = APIRouter(tags=["Enterprise"])

_mcp = MCPProxyInterceptor()
_otel = OTELTraceIngestor()
_gateway = MCPRuntimeGateway()
_github_execution = GitHubExecutionCoordinator(gateway=_gateway)


class GitHubInstallationEnrollment(BaseModel):
    """Operator-owned binding before signed GitHub events may enter a tenant."""

    model_config = ConfigDict(extra="forbid")

    github_installation_id: str = Field(min_length=1, max_length=255)
    account_login: str | None = Field(default=None, max_length=255)


@router.post("/mcp/proxy")
def mcp_proxy_inspect(req: MCPJsonRpcRequest) -> dict[str, Any]:
    """Inspect MCP JSON-RPC requests for tool poisoning / injection before forwarding."""
    return _mcp.inspect_request(req).model_dump()


@router.post("/mcp/actions/evaluate")
async def evaluate_managed_github_action(
    payload: GatewayActionInput,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Make and persist a pre-execution decision for an ARTSA GitHub action.

    This is an enforcement decision endpoint, not a generic forwarding proxy:
    no GitHub credentials are read and no external action is performed here.
    A future managed GitHub adapter may execute only an ``ALLOW`` decision or a
    separately consumed, bound approval.
    """
    decision = await _gateway.decide(db, tenant_id=tenant_id, payload=payload)
    # ``get_db`` deliberately leaves transaction ownership to write routes.
    # A flush alone is not durable once the request-scoped session closes.
    await db.commit()
    return decision.model_dump(mode="json")


@router.post("/mcp/actions/execute")
async def execute_managed_github_action(
    payload: GatewayActionInput,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict[str, Any]:
    """Execute the sole approval-gated v1 GitHub write: create an issue.

    This remains a managed transport endpoint. It does not accept GitHub
    credentials or arbitrary REST paths, and the only raw tool result returned
    is screened in memory to the authenticated MCP caller.
    """
    execution = await _github_execution.execute(
        db, redis=redis, tenant_id=tenant_id, payload=payload
    )
    await db.commit()
    return execution.model_dump(mode="json")


@router.get("/mcp/evidence")
async def list_managed_mcp_evidence(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
) -> list[dict[str, Any]]:
    """Redacted, tenant-scoped decision timeline for security operators.

    This intentionally exposes only identifiers, policy context, decisions and
    timing. Request arguments, GitHub issue bodies, tokens and raw tool output
    remain outside the API contract.
    """
    safe_limit = max(1, min(limit, 100))
    rows = (
        await db.execute(
            select(MCPActionEvidenceORM)
            .where(MCPActionEvidenceORM.tenant_id == tenant_id)
            .order_by(MCPActionEvidenceORM.created_at.desc())
            .limit(safe_limit)
        )
    ).scalars().all()
    return [
        {
            "id": row.id,
            "action_id": row.action_id,
            "session_id": row.session_id,
            "trace_id": row.trace_id,
            "agent_id": row.agent_id,
            "integration": row.integration,
            "github_installation_id": row.github_installation_id,
            "repository": row.resource,
            "tool": row.tool,
            "operation": row.operation,
            "policy_version": row.policy_version,
            "outcome": row.outcome,
            "reason_codes": row.reason_codes or [],
            "finding_categories": row.finding_categories or [],
            "approval_id": row.approval_id,
            "execution_state": row.execution_state,
            "execution_latency_ms": row.execution_latency_ms,
            "execution_findings": row.execution_findings or [],
            "github_issue_number": row.github_issue_number,
            "reconciled_at": row.reconciled_at,
            "executed_at": row.executed_at,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/github/installations", status_code=201)
async def enroll_github_installation(
    payload: GitHubInstallationEnrollment,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Create the tenant binding required before webhook inventory projection."""
    existing = (
        await db.execute(
            select(GitHubInstallationORM).where(
                GitHubInstallationORM.github_installation_id == payload.github_installation_id
            )
        )
    ).scalar_one_or_none()
    if existing and existing.tenant_id != tenant_id:
        raise HTTPException(status_code=409, detail="GitHub installation is already bound to another tenant")
    if existing is None:
        existing = GitHubInstallationORM(
            tenant_id=tenant_id,
            github_installation_id=payload.github_installation_id,
            account_login=payload.account_login,
            status="PENDING",
        )
        db.add(existing)
    elif payload.account_login:
        existing.account_login = payload.account_login
    await db.commit()
    await db.refresh(existing)
    return installation_view(existing)


@router.get("/github/inventory")
async def github_inventory(
    db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)
) -> dict[str, list[dict[str, Any]]]:
    installations = (
        await db.execute(
            select(GitHubInstallationORM)
            .where(GitHubInstallationORM.tenant_id == tenant_id)
            .order_by(GitHubInstallationORM.updated_at.desc())
        )
    ).scalars().all()
    repositories = (
        await db.execute(
            select(GitHubRepositoryORM)
            .where(GitHubRepositoryORM.tenant_id == tenant_id)
            .order_by(GitHubRepositoryORM.full_name)
        )
    ).scalars().all()
    return {"installations": [installation_view(row) for row in installations], "repositories": [repository_view(row) for row in repositories]}


@router.post("/github/webhooks", status_code=202)
async def github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(None),
    x_github_delivery: str | None = Header(None),
    x_github_event: str | None = Header(None),
    redis=Depends(get_redis),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Accept only signed, de-duplicated GitHub App webhooks.

    The first connector slice validates and deduplicates delivery envelopes but
    deliberately does not retain the webhook body. Inventory/reconciliation
    projection is added with tenant-bound installation records in the next
    migration.
    """
    if not x_github_delivery or not x_github_event:
        raise HTTPException(status_code=400, detail="GitHub delivery and event headers are required")
    body = await request.body()
    if len(body) > 1_048_576:
        raise HTTPException(status_code=413, detail="GitHub webhook exceeds the maximum body size")
    if not verify_github_webhook_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="invalid GitHub webhook signature")
    # Delivery IDs are opaque GitHub identifiers. TTL deduplication prevents a
    # replay from producing duplicate downstream inventory/reconciliation work.
    if not redis.set_nx(f"artsa:github:webhook:{x_github_delivery}", x_github_event, 86_400):
        return Response(status_code=202, headers={"X-ARTSA-Webhook-Duplicate": "true"})
    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="GitHub webhook body must be valid JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="GitHub webhook body must be a JSON object")
    await project_signed_github_webhook(db, event_name=x_github_event, payload=payload)
    await db.commit()
    return Response(status_code=202)


@router.get("/mcp/inspections")
def get_mcp_inspections() -> dict[str, Any]:
    """Return recent MCP inspection history."""
    return {"inspections": [r.model_dump() for r in _mcp.get_history()]}


@router.post("/otel/v1/traces")
def otel_trace_ingest(payload: OTELTracePayload) -> dict[str, Any]:
    """Ingest OpenTelemetry / OpenInference spans and flag exploitation drift.

    EXPERIMENTAL: gated behind ``ARTSA_OTEL_ENABLED`` (default off). Returns 404
    when disabled — this is not a supported capability.
    """
    if not settings.ARTSA_OTEL_ENABLED:
        raise HTTPException(
            status_code=404,
            detail=(
                "OTEL trace ingest is experimental and disabled by default; "
                "set ARTSA_OTEL_ENABLED=true to enable"
            ),
        )
    return _otel.process_trace(payload).model_dump()
