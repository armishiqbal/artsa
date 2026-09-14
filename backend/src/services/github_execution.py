"""Approval-gated execution coordinator for ARTSA-managed GitHub actions."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.data.orm import MCPActionEvidenceORM
from src.mcp.contracts import ActionDecision, ActionOutcome
from src.runtime.actions import RuntimeAction
from src.runtime.gate import RuntimeGate, get_runtime_gate
from src.services.approval_service import consume_retry_token_approval_id
from src.services.github_connector import (
    GitHubAppClient,
    GitHubConfigurationError,
    GitHubToolNotSupported,
)
from src.services.mcp_gateway import GatewayActionInput, MCPRuntimeGateway
from src.services.prometheus_metrics import record_github_execution


class ExecutionState(str, Enum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"
    OUTPUT_BLOCKED = "OUTPUT_BLOCKED"
    CANCELLED = "CANCELLED"


class ManagedActionExecution(BaseModel):
    """Terminal API result; ``tool_result`` is returned only to the caller."""

    model_config = ConfigDict(extra="forbid")

    decision: ActionDecision
    execution_state: ExecutionState
    tool_result: dict[str, Any] | None = None


class GitHubExecutionCoordinator:
    """The sole service permitted to invoke a managed GitHub write handler."""

    def __init__(
        self,
        gateway: MCPRuntimeGateway | None = None,
        adapter: GitHubAppClient | None = None,
        output_gate: RuntimeGate | None = None,
    ) -> None:
        self._gateway = gateway or MCPRuntimeGateway()
        self._adapter = adapter or GitHubAppClient()
        self._output_gate = output_gate or get_runtime_gate()

    @staticmethod
    def _binding_context(tenant_id: str, payload: GatewayActionInput) -> dict[str, str]:
        return {
            "tenant_id": tenant_id,
            "github_installation_id": payload.github_installation_id,
            "resource": payload.resource,
            "tool": payload.tool,
            "policy_version": payload.policy_version,
        }

    async def execute(
        self, db: AsyncSession, *, redis: Any, tenant_id: str, payload: GatewayActionInput
    ) -> ManagedActionExecution:
        # Evaluation is idempotent, but execution is never repeatable under an
        # existing action ID. A retry must carry a new action ID and the bound
        # one-time approval token.
        if hasattr(db, "execute"):
            existing = (
                await db.execute(
                    select(MCPActionEvidenceORM).where(
                        MCPActionEvidenceORM.tenant_id == tenant_id,
                        MCPActionEvidenceORM.action_id == str(payload.action_id),
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                decision = ActionDecision(
                    action_id=payload.action_id,
                    outcome=ActionOutcome.BLOCK,
                    reason_codes=["action_id_reuse_for_execution"],
                    finding_categories=[],
                    detector_version=existing.detector_version,
                    policy_version=existing.policy_version,
                    evidence_id=uuid.UUID(existing.id),
                    approval_id=existing.approval_id,
                    latency_ms=0,
                    expires_at=existing.expires_at,
                )
                record_github_execution("retry_rejected")
                return ManagedActionExecution(
                    decision=decision, execution_state=ExecutionState.CANCELLED
                )
        # This endpoint is intentionally issue-only.  Every other operation is
        # still a decision-only capability until it gets a dedicated handler.
        if payload.tool != "github_create_issue":
            decision = await self._gateway.decide(db, tenant_id=tenant_id, payload=payload)
            return ManagedActionExecution(decision=decision, execution_state=ExecutionState.PENDING)

        approved_retry_id: str | None = None
        if payload.approval_retry_token:
            approved_retry_id = consume_retry_token_approval_id(
                redis,
                payload.approval_retry_token,
                tenant_id=tenant_id,
                session_id=payload.session_id,
                tool_name=payload.tool,
                arguments=payload.arguments,
                binding_context=self._binding_context(tenant_id, payload),
            )
        decision = await self._gateway.decide(
            db, tenant_id=tenant_id, payload=payload, approved_retry_id=approved_retry_id
        )
        if decision.outcome is not ActionOutcome.ALLOW:
            if payload.approval_retry_token:
                record_github_execution("retry_rejected")
            return ManagedActionExecution(decision=decision, execution_state=ExecutionState.PENDING)

        started = time.perf_counter()
        try:
            async with asyncio.timeout(15):
                result = await self._adapter.execute_create_issue(
                    installation_id=payload.github_installation_id,
                    resource=payload.resource,
                    arguments=payload.arguments,
                )
        except (GitHubConfigurationError, GitHubToolNotSupported, httpx.HTTPError, TimeoutError, ValueError):
            terminal = self._terminal_decision(decision, ActionOutcome.UNAVAILABLE, "github_execution_failed")
            await self._record_terminal(
                db, terminal, ExecutionState.FAILED, result_sha256=None, findings=[], started=started,
                github_issue_number=None,
            )
            record_github_execution("failed", (time.perf_counter() - started) * 1000)
            return ManagedActionExecution(decision=terminal, execution_state=ExecutionState.FAILED)

        # GitHub output is untrusted tool data.  Do not return it until output
        # screening completes; persist only its digest and category metadata.
        response_text = json.dumps(result.data, sort_keys=True, separators=(",", ":"), default=str)
        scan = self._output_gate.evaluate(
            output_text=response_text,
            session_id=payload.session_id,
            untrusted_tool_result=True,
        )
        if scan.action is not RuntimeAction.ALLOW:
            terminal = self._terminal_decision(decision, ActionOutcome.BLOCK, "github_output_blocked")
            categories = list(dict.fromkeys(f.category for f in scan.findings))[:20]
            await self._record_terminal(
                db, terminal, ExecutionState.OUTPUT_BLOCKED,
                result_sha256=scan.body_sha256, findings=categories, started=started, github_issue_number=None,
            )
            record_github_execution("output_blocked", (time.perf_counter() - started) * 1000)
            return ManagedActionExecution(decision=terminal, execution_state=ExecutionState.OUTPUT_BLOCKED)

        await self._record_terminal(
            db, decision, ExecutionState.EXECUTED,
            result_sha256=scan.body_sha256, findings=[], started=started,
            github_issue_number=(
                result.data.get("number")
                if isinstance(result.data, dict) and isinstance(result.data.get("number"), int)
                else None
            ),
        )
        record_github_execution("executed", (time.perf_counter() - started) * 1000)
        return ManagedActionExecution(
            decision=decision, execution_state=ExecutionState.EXECUTED, tool_result=result.data
        )

    async def execute_read(
        self, db: AsyncSession, *, tenant_id: str, payload: GatewayActionInput
    ) -> ManagedActionExecution:
        """Run a bounded GitHub read after policy and output screening.

        Reads have no approval branch, but they still use the same gateway,
        tenant scope, output gate and digest-only lifecycle evidence as writes.
        The raw response stays in memory until the authenticated MCP caller is
        sent its screened result.
        """
        decision = await self._gateway.decide(db, tenant_id=tenant_id, payload=payload)
        if decision.outcome is not ActionOutcome.ALLOW:
            return ManagedActionExecution(decision=decision, execution_state=ExecutionState.PENDING)
        started = time.perf_counter()
        try:
            async with asyncio.timeout(15):
                result = await self._adapter.execute_read(
                    installation_id=payload.github_installation_id,
                    tool=payload.tool,
                    resource=payload.resource,
                    arguments=payload.arguments,
                )
        except (GitHubConfigurationError, GitHubToolNotSupported, httpx.HTTPError, TimeoutError, ValueError):
            terminal = self._terminal_decision(decision, ActionOutcome.UNAVAILABLE, "github_read_failed")
            await self._record_terminal(
                db, terminal, ExecutionState.FAILED, result_sha256=None, findings=[], started=started,
                github_issue_number=None,
            )
            record_github_execution("failed", (time.perf_counter() - started) * 1000)
            return ManagedActionExecution(decision=terminal, execution_state=ExecutionState.FAILED)

        response_text = json.dumps(result.data, sort_keys=True, separators=(",", ":"), default=str)
        scan = self._output_gate.evaluate(
            output_text=response_text,
            session_id=payload.session_id,
            untrusted_tool_result=True,
        )
        if scan.action is not RuntimeAction.ALLOW:
            terminal = self._terminal_decision(decision, ActionOutcome.BLOCK, "github_output_blocked")
            categories = list(dict.fromkeys(f.category for f in scan.findings))[:20]
            await self._record_terminal(
                db, terminal, ExecutionState.OUTPUT_BLOCKED, result_sha256=scan.body_sha256,
                findings=categories, started=started, github_issue_number=None,
            )
            record_github_execution("output_blocked", (time.perf_counter() - started) * 1000)
            return ManagedActionExecution(decision=terminal, execution_state=ExecutionState.OUTPUT_BLOCKED)

        await self._record_terminal(
            db, decision, ExecutionState.EXECUTED, result_sha256=scan.body_sha256,
            findings=[], started=started, github_issue_number=None,
        )
        record_github_execution("executed", (time.perf_counter() - started) * 1000)
        return ManagedActionExecution(
            decision=decision, execution_state=ExecutionState.EXECUTED, tool_result=result.data
        )

    @staticmethod
    def _terminal_decision(
        decision: ActionDecision, outcome: ActionOutcome, reason_code: str
    ) -> ActionDecision:
        return decision.model_copy(update={"outcome": outcome, "reason_codes": [reason_code]})

    async def _record_terminal(
        self, db: AsyncSession, decision: ActionDecision, state: ExecutionState,
        *, result_sha256: str | None, findings: list[str], started: float,
        github_issue_number: int | None,
    ) -> None:
        row = None
        if hasattr(db, "execute"):
            row = (await db.execute(select(MCPActionEvidenceORM).where(
                MCPActionEvidenceORM.id == str(decision.evidence_id)
            ))).scalar_one_or_none()
        elif hasattr(db, "rows"):
            row = next((item for item in db.rows if getattr(item, "id", None) == str(decision.evidence_id)), None)
        if row is None:
            return
        row.outcome = decision.outcome.value
        row.reason_codes = decision.reason_codes
        row.execution_state = state.value
        row.result_sha256 = result_sha256
        row.execution_latency_ms = max(0, round((time.perf_counter() - started) * 1000))
        row.execution_findings = findings
        row.github_issue_number = github_issue_number
        row.executed_at = datetime.now(UTC)
        await db.flush()
