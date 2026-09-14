"""Pre-execution decision service for ARTSA-managed GitHub MCP actions.

The gateway deliberately evaluates an action *before* an adapter can obtain or
use a GitHub installation token.  It accepts raw arguments only in process to
calculate their digest and inspect them; persistence and its public decision
contract are digest-only.
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.readiness import embeddings_readiness
from src.data.orm import MCPActionEvidenceORM
from src.mcp.contracts import ActionDecision, ActionOutcome, ActionRequest
from src.services.approval_service import create_request
from src.services.mcp_proxy import MCPJsonRpcRequest, MCPProxyInterceptor

GITHUB_READ_TOOLS = frozenset(
    {
        "github_get_repository",
        "github_list_repositories",
        "github_get_issue",
        "github_list_issues",
        "github_get_pull_request",
        "github_list_pull_requests",
        "github_get_file_contents",
    }
)
GITHUB_GUARDED_WRITE_TOOLS = frozenset(
    {
        "github_create_branch",
        "github_create_pull_request",
        "github_create_issue",
        "github_comment_on_issue",
    }
)
GITHUB_V1_TOOLS = GITHUB_READ_TOOLS | GITHUB_GUARDED_WRITE_TOOLS


class GatewayActionInput(BaseModel):
    """Inbound action metadata plus ephemeral arguments.

    ``arguments`` must never be included in telemetry, evidence, responses,
    or approval records.  The server derives ``arguments_sha256`` itself.
    """

    model_config = ConfigDict(extra="forbid")

    action_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    trace_id: str = Field(min_length=1, max_length=255)
    agent_id: str = Field(min_length=1, max_length=255)
    actor_id: str | None = Field(default=None, max_length=255)
    github_installation_id: str = Field(min_length=1, max_length=255)
    tool: str = Field(min_length=1, max_length=128)
    resource: str = Field(min_length=1, max_length=512)
    operation: str = Field(min_length=1, max_length=128)
    arguments: dict[str, Any] = Field(default_factory=dict)
    source_trust: str = Field(default="untrusted", pattern="^(trusted|untrusted|mixed)$")
    data_classification: str = Field(
        default="internal", pattern="^(public|internal|confidential|restricted)$"
    )
    policy_version: str = Field(default="github-v1", min_length=1, max_length=128)
    approval_retry_token: str | None = Field(default=None, min_length=16, max_length=512)


def arguments_digest(arguments: dict[str, Any]) -> str:
    """Produce the sole durable representation of an action's arguments."""
    encoded = json.dumps(arguments, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


class MCPRuntimeGateway:
    """Tenant-aware decision point used by the future HTTP and stdio transports."""

    detector_version = "mcp-containment-v1"

    def __init__(self, inspector: MCPProxyInterceptor | None = None) -> None:
        # No tool allow-list here: the controlled GitHub catalog is enforced
        # separately, before a generic proxy could ever forward a call.
        self._inspector = inspector or MCPProxyInterceptor()

    @staticmethod
    def _semantic_model_ready() -> bool:
        """Production semantic evaluation is local-only and never silently weakens."""
        if settings.ENVIRONMENT != "production":
            return True
        model = settings.resolve_embedding_model()
        if not model.startswith("local-"):
            return False
        ready, _detail = embeddings_readiness()
        return ready

    async def decide(
        self, db: AsyncSession, *, tenant_id: str, payload: GatewayActionInput,
        approved_retry_id: str | None = None,
    ) -> ActionDecision:
        started = time.perf_counter()
        request = ActionRequest(
            action_id=payload.action_id,
            tenant_id=tenant_id,
            session_id=payload.session_id,
            trace_id=payload.trace_id,
            agent_id=payload.agent_id,
            actor_id=payload.actor_id,
            integration="github",
            github_installation_id=payload.github_installation_id,
            tool=payload.tool,
            resource=payload.resource,
            operation=payload.operation,
            arguments_sha256=arguments_digest(payload.arguments),
            source_trust=payload.source_trust,
            data_classification=payload.data_classification,
            policy_version=payload.policy_version,
        )
        # Same tenant + action ID is an idempotency key.  Repeated delivery
        # returns the original decision instead of queueing a second approval.
        if hasattr(db, "execute"):
            existing = (
                await db.execute(
                    select(MCPActionEvidenceORM).where(
                        MCPActionEvidenceORM.tenant_id == tenant_id,
                        MCPActionEvidenceORM.action_id == str(request.action_id),
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                return ActionDecision(
                    action_id=request.action_id,
                    outcome=ActionOutcome(existing.outcome),
                    reason_codes=existing.reason_codes or [],
                    finding_categories=existing.finding_categories or [],
                    detector_version=existing.detector_version,
                    policy_version=existing.policy_version,
                    evidence_id=uuid.UUID(existing.id),
                    approval_id=existing.approval_id,
                    latency_ms=existing.latency_ms,
                    expires_at=existing.expires_at,
                )
        reason_codes: list[str] = []
        categories: list[str] = []
        outcome = ActionOutcome.ALLOW
        approval_id: str | None = None
        expires_at: datetime | None = None

        if request.tool not in GITHUB_V1_TOOLS:
            outcome = ActionOutcome.BLOCK
            reason_codes.append("github_tool_not_supported_v1")
        elif not self._semantic_model_ready():
            outcome = ActionOutcome.UNAVAILABLE
            reason_codes.append("local_semantic_model_unavailable")
        else:
            inspection = self._inspector.inspect_request(
                MCPJsonRpcRequest(
                    method="tools/call",
                    params={"name": request.tool, "arguments": payload.arguments},
                ),
                session_id=request.session_id,
            )
            if not inspection.is_safe:
                outcome = ActionOutcome.BLOCK
                reason_codes.append("containment_detection")
                categories = list(dict.fromkeys(inspection.detected_patterns))[:20]
            elif request.tool in GITHUB_GUARDED_WRITE_TOOLS and approved_retry_id:
                outcome = ActionOutcome.ALLOW
                reason_codes.append("approval_retry_consumed")
                approval_id = approved_retry_id
            elif request.tool in GITHUB_GUARDED_WRITE_TOOLS and payload.approval_retry_token:
                outcome = ActionOutcome.BLOCK
                reason_codes.append("approval_retry_token_invalid")
            elif request.tool in GITHUB_GUARDED_WRITE_TOOLS:
                outcome = ActionOutcome.REQUIRE_APPROVAL
                reason_codes.append("github_write_requires_approval")
                approval = await create_request(
                    db,
                    tenant_id=tenant_id,
                    session_id=request.session_id,
                    tool_name=request.tool,
                    arguments=payload.arguments,
                    findings=[],
                    requester={"agent_id": request.agent_id, "actor_id": request.actor_id},
                    binding_context={
                        "tenant_id": request.tenant_id,
                        "github_installation_id": request.github_installation_id,
                        "resource": request.resource,
                        "tool": request.tool,
                        "policy_version": request.policy_version,
                    },
                )
                approval_id = approval.id
                expires_at = approval.expires_at

        latency_ms = max(0, round((time.perf_counter() - started) * 1000))
        evidence_id = uuid.uuid4()
        db.add(
            MCPActionEvidenceORM(
                id=str(evidence_id),
                tenant_id=request.tenant_id,
                action_id=str(request.action_id),
                session_id=str(request.session_id),
                trace_id=request.trace_id,
                agent_id=request.agent_id,
                actor_id=request.actor_id,
                integration=request.integration,
                github_installation_id=request.github_installation_id,
                tool=request.tool,
                resource=request.resource,
                operation=request.operation,
                arguments_sha256=request.arguments_sha256,
                source_trust=request.source_trust,
                data_classification=request.data_classification,
                policy_version=request.policy_version,
                outcome=outcome.value,
                reason_codes=reason_codes,
                finding_categories=categories,
                detector_version=self.detector_version,
                latency_ms=latency_ms,
                approval_id=approval_id,
                expires_at=expires_at,
                created_at=datetime.now(UTC),
            )
        )
        await db.flush()
        return ActionDecision(
            action_id=request.action_id,
            outcome=outcome,
            reason_codes=reason_codes,
            finding_categories=categories,
            detector_version=self.detector_version,
            policy_version=request.policy_version,
            evidence_id=evidence_id,
            approval_id=approval_id,
            latency_ms=latency_ms,
            expires_at=expires_at,
        )
