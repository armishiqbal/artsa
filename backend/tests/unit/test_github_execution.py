"""End-to-end unit coverage for approval-gated GitHub issue execution."""

from __future__ import annotations

import uuid
from typing import Any

import httpx
import pytest
from src.data.redis_client import InMemoryRedis
from src.runtime.actions import RuntimeAction
from src.runtime.gate import RuntimeDecision
from src.services.approval_service import issue_retry_token
from src.services.github_connector import GitHubConfigurationError, GitHubToolResult
from src.services.github_execution import ExecutionState, GitHubExecutionCoordinator
from src.services.mcp_gateway import GatewayActionInput, MCPRuntimeGateway


class FakeDB:
    def __init__(self) -> None:
        self.rows: list[object] = []

    def add(self, row: object) -> None:
        self.rows.append(row)

    async def flush(self) -> None:
        return None


class FakeGitHubAdapter:
    async def execute_create_issue(self, **_: Any) -> GitHubToolResult:
        return GitHubToolResult(
            status_code=201,
            data={"number": 7, "html_url": "https://github.com/acme/repo/issues/7"},
            rate_limit_remaining="4999",
        )


class FakeReadGitHubAdapter:
    async def execute_read(self, **_: Any) -> GitHubToolResult:
        return GitHubToolResult(
            status_code=200,
            data={"full_name": "acme/repo", "private": True},
            rate_limit_remaining="4999",
        )


def issue_payload(**changes: Any) -> GatewayActionInput:
    values: dict[str, Any] = {
        "action_id": uuid.uuid4(),
        "session_id": uuid.uuid4(),
        "trace_id": "trace-issue-1",
        "agent_id": "agent-1",
        "github_installation_id": "installation-1",
        "tool": "github_create_issue",
        "resource": "acme/repo",
        "operation": "issues.create",
        "arguments": {"title": "Security review"},
    }
    values.update(changes)
    return GatewayActionInput(**values)


@pytest.mark.asyncio
async def test_issue_requires_approval_then_executes_once_with_matching_retry() -> None:
    db, redis = FakeDB(), InMemoryRedis()
    coordinator = GitHubExecutionCoordinator(gateway=MCPRuntimeGateway(), adapter=FakeGitHubAdapter())
    initial = issue_payload()

    pending = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=initial)
    assert pending.decision.outcome.value == "REQUIRE_APPROVAL"
    assert pending.execution_state is ExecutionState.PENDING
    approval = db.rows[0]
    approval.status = "APPROVED"
    retry = issue_retry_token(redis, approval)

    resumed = issue_payload(
        session_id=initial.session_id,
        approval_retry_token=retry,
        arguments=initial.arguments,
    )
    executed = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=resumed)
    assert executed.decision.outcome.value == "ALLOW"
    assert executed.execution_state is ExecutionState.EXECUTED
    assert executed.tool_result == {"number": 7, "html_url": "https://github.com/acme/repo/issues/7"}
    evidence = db.rows[-1]
    assert evidence.execution_state == "EXECUTED"
    assert len(evidence.result_sha256) == 64
    assert not hasattr(evidence, "arguments")

    reused = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=resumed)
    assert reused.decision.outcome.value == "BLOCK"


@pytest.mark.asyncio
async def test_changed_issue_arguments_cannot_consume_an_approval_retry() -> None:
    db, redis = FakeDB(), InMemoryRedis()
    coordinator = GitHubExecutionCoordinator(gateway=MCPRuntimeGateway(), adapter=FakeGitHubAdapter())
    initial = issue_payload()
    await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=initial)
    approval = db.rows[0]
    approval.status = "APPROVED"
    retry = issue_retry_token(redis, approval)

    changed = issue_payload(
        session_id=initial.session_id,
        approval_retry_token=retry,
        arguments={"title": "Changed after approval"},
    )
    result = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=changed)
    assert result.decision.outcome.value == "BLOCK"
    assert result.decision.reason_codes == ["approval_retry_token_invalid"]


class BlockingOutputGate:
    def evaluate(self, **_: Any) -> RuntimeDecision:
        return RuntimeDecision(
            action=RuntimeAction.BLOCK, findings=[], body_sha256="a" * 64, stream=False
        )


@pytest.mark.asyncio
async def test_unsafe_github_output_is_not_returned_to_the_agent() -> None:
    db, redis = FakeDB(), InMemoryRedis()
    coordinator = GitHubExecutionCoordinator(
        gateway=MCPRuntimeGateway(), adapter=FakeGitHubAdapter(), output_gate=BlockingOutputGate()
    )
    initial = issue_payload()
    await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=initial)
    approval = db.rows[0]
    approval.status = "APPROVED"
    retry = issue_retry_token(redis, approval)
    resumed = issue_payload(
        session_id=initial.session_id, approval_retry_token=retry, arguments=initial.arguments
    )

    result = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=resumed)
    assert result.decision.outcome.value == "BLOCK"
    assert result.execution_state is ExecutionState.OUTPUT_BLOCKED
    assert result.tool_result is None


class FailingGitHubAdapter:
    async def execute_create_issue(self, **_: Any) -> GitHubToolResult:
        raise GitHubConfigurationError("GitHub App credentials are not configured")


@pytest.mark.parametrize(
    "failure",
    [
        httpx.HTTPStatusError(
            "GitHub returned 403",
            request=httpx.Request("POST", "https://api.github.com/repos/acme/repo/issues"),
            response=httpx.Response(403),
        ),
        httpx.ReadTimeout("GitHub timed out"),
        ValueError("malformed GitHub JSON"),
    ],
    ids=["http-403", "timeout", "malformed-json"],
)
@pytest.mark.asyncio
async def test_github_failures_are_unavailable_and_never_success(
    failure: Exception,
) -> None:
    class UnstableGitHubAdapter:
        async def execute_create_issue(self, **_: Any) -> GitHubToolResult:
            raise failure

    db, redis = FakeDB(), InMemoryRedis()
    coordinator = GitHubExecutionCoordinator(
        gateway=MCPRuntimeGateway(), adapter=UnstableGitHubAdapter()
    )
    initial = issue_payload()
    await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=initial)
    approval = db.rows[0]
    approval.status = "APPROVED"
    retry = issue_retry_token(redis, approval)
    resumed = issue_payload(
        session_id=initial.session_id,
        approval_retry_token=retry,
        arguments=initial.arguments,
    )

    result = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=resumed)
    assert result.decision.outcome.value == "UNAVAILABLE"
    assert result.execution_state is ExecutionState.FAILED
    assert result.tool_result is None


@pytest.mark.asyncio
async def test_retry_token_cannot_cross_tenant_boundary() -> None:
    db, redis = FakeDB(), InMemoryRedis()
    coordinator = GitHubExecutionCoordinator(
        gateway=MCPRuntimeGateway(), adapter=FakeGitHubAdapter()
    )
    initial = issue_payload()
    await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=initial)
    approval = db.rows[0]
    approval.status = "APPROVED"
    retry = issue_retry_token(redis, approval)

    resumed = issue_payload(
        session_id=initial.session_id,
        approval_retry_token=retry,
        arguments=initial.arguments,
    )
    result = await coordinator.execute(db, redis=redis, tenant_id="tenant-b", payload=resumed)
    assert result.decision.outcome.value == "BLOCK"
    assert result.decision.reason_codes == ["approval_retry_token_invalid"]


@pytest.mark.asyncio
async def test_github_execution_failure_is_unavailable_not_a_false_success() -> None:
    db, redis = FakeDB(), InMemoryRedis()
    coordinator = GitHubExecutionCoordinator(
        gateway=MCPRuntimeGateway(), adapter=FailingGitHubAdapter()
    )
    initial = issue_payload()
    await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=initial)
    approval = db.rows[0]
    approval.status = "APPROVED"
    retry = issue_retry_token(redis, approval)
    resumed = issue_payload(
        session_id=initial.session_id, approval_retry_token=retry, arguments=initial.arguments
    )

    result = await coordinator.execute(db, redis=redis, tenant_id="tenant-a", payload=resumed)
    assert result.decision.outcome.value == "UNAVAILABLE"
    assert result.execution_state is ExecutionState.FAILED
    assert result.tool_result is None


@pytest.mark.asyncio
async def test_bounded_read_executes_only_after_gateway_allow_and_is_output_screened() -> None:
    db = FakeDB()
    coordinator = GitHubExecutionCoordinator(
        gateway=MCPRuntimeGateway(), adapter=FakeReadGitHubAdapter()
    )
    payload = issue_payload(
        tool="github_get_repository", operation="get_repository", arguments={}
    )
    result = await coordinator.execute_read(db, tenant_id="tenant-a", payload=payload)
    assert result.decision.outcome.value == "ALLOW"
    assert result.execution_state is ExecutionState.EXECUTED
    assert result.tool_result == {"full_name": "acme/repo", "private": True}
    evidence = db.rows[-1]
    assert evidence.execution_state == "EXECUTED"
    assert len(evidence.result_sha256) == 64
