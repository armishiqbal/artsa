"""Managed Streamable HTTP MCP protocol and authority boundary tests."""

import pytest
from fastapi.testclient import TestClient
from src.api.main import create_app
from src.api.routes.mcp_http import (
    _cancel_correlated_action,
    _tool_definitions,
    _validate_tool_arguments,
)


def test_server_side_tool_schema_rejects_unknown_and_invalid_fields() -> None:
    valid, detail = _validate_tool_arguments(
        "github_create_issue",
        {"installation_id": "i-1", "repository": "octo/example", "title": "Review"},
    )
    assert valid is True
    assert detail == ""
    valid, detail = _validate_tool_arguments(
        "github_create_issue",
        {"installation_id": "i-1", "repository": "octo/example", "title": "Review", "url": "https://evil.example"},
    )
    assert valid is False
    assert "unsupported" in detail


def test_tools_list_uses_explicit_catalog_not_arbitrary_agent_tool_names() -> None:
    definitions = _tool_definitions({"github_create_issue", "github_delete_repository"})
    assert [item["name"] for item in definitions] == ["github_create_issue"]
    valid, _ = _validate_tool_arguments("github_delete_repository", {})
    assert valid is False


def test_mcp_rejects_malformed_and_unregistered_sessions() -> None:
    with TestClient(create_app()) as client:
        malformed = client.post("/api/v1/mcp", content=b"not-json")
        assert malformed.status_code == 200
        assert malformed.json()["error"]["code"] == -32600

        unregistered = client.post(
            "/api/v1/mcp",
            json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"agent_id": "unknown"}},
        )
        assert unregistered.status_code == 200
        assert unregistered.json()["error"]["code"] == -32001

        no_session = client.post(
            "/api/v1/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        )
        assert no_session.status_code == 200
        assert no_session.json()["error"]["code"] == -32002


@pytest.mark.asyncio
async def test_cancellation_is_durable_for_a_pending_approval() -> None:
    """The action, not its sensitive arguments, is the cancellation target."""
    from datetime import UTC, datetime

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.data.db import Base
    from src.data.orm import ApprovalRequestORM, MCPActionEvidenceORM

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        now = datetime.now(UTC)
        db.add(
            ApprovalRequestORM(
                id="approval-1", tenant_id="tenant-a", session_id="session-1", operation_sha256="a" * 64,
                tool_name="github_create_issue", expires_at=now,
            )
        )
        db.add(
            MCPActionEvidenceORM(
                id="evidence-1", tenant_id="tenant-a", action_id="action-1", session_id="session-1", trace_id="trace-1",
                agent_id="agent-1", integration="github", github_installation_id="install-1", tool="github_create_issue",
                resource="acme/repo", operation="create_issue", arguments_sha256="b" * 64, source_trust="trusted",
                data_classification="internal", policy_version="github-v1", outcome="REQUIRE_APPROVAL", reason_codes=[],
                finding_categories=[], detector_version="test", latency_ms=1, approval_id="approval-1", execution_state="PENDING", created_at=now,
            )
        )
        await db.commit()
        assert await _cancel_correlated_action(db, tenant_id="tenant-a", session_id="session-1", action_id="action-1")
        evidence = (await db.execute(select(MCPActionEvidenceORM))).scalar_one()
        approval = (await db.execute(select(ApprovalRequestORM))).scalar_one()
        assert evidence.execution_state == "CANCELLED"
        assert evidence.outcome == "BLOCK"
        assert "mcp_request_cancelled" in evidence.reason_codes
        assert approval.status == "CANCELLED"
    await engine.dispose()
