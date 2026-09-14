"""Signed GitHub webhook inventory and issue reconciliation coverage."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from src.data.db import Base
from src.data.orm import GitHubInstallationORM, GitHubRepositoryORM, MCPActionEvidenceORM
from src.services.github_inventory import project_signed_github_webhook


@pytest.mark.asyncio
async def test_signed_webhook_projects_repository_and_reconciles_exact_issue_number() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(UTC)
    async with factory() as db:
        installation = GitHubInstallationORM(
            id="installation-row", tenant_id="tenant-a", github_installation_id="123", status="ACTIVE"
        )
        db.add(installation)
        db.add(
            MCPActionEvidenceORM(
                id="evidence-1", tenant_id="tenant-a", action_id="action-1", session_id="session-1",
                trace_id="trace-1", agent_id="agent-1", integration="github", github_installation_id="123",
                tool="github_create_issue", resource="acme/repo", operation="create_issue",
                arguments_sha256="a" * 64, source_trust="trusted", data_classification="internal",
                policy_version="github-v1", outcome="ALLOW", reason_codes=[], finding_categories=[],
                detector_version="test", latency_ms=1, execution_state="EXECUTED", github_issue_number=42,
                created_at=now,
            )
        )
        await db.commit()
        matched = await project_signed_github_webhook(
            db,
            event_name="issues",
            payload={
                "action": "opened",
                "installation": {"id": 123},
                "repository": {"id": 99, "full_name": "acme/repo", "private": True, "archived": False, "default_branch": "main"},
                "issue": {"number": 42, "title": "must not persist", "body": "secret body"},
            },
        )
        await db.commit()
        assert matched is True
        repository = (await db.execute(select(GitHubRepositoryORM))).scalar_one()
        assert repository.full_name == "acme/repo"
        evidence = (await db.execute(select(MCPActionEvidenceORM))).scalar_one()
        assert evidence.reconciled_at is not None
        assert not hasattr(evidence, "issue_body")
    await engine.dispose()


@pytest.mark.asyncio
async def test_unknown_installation_cannot_create_inventory() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        matched = await project_signed_github_webhook(
            db,
            event_name="repository",
            payload={"installation": {"id": 999}, "repository": {"id": 1, "full_name": "wrong/tenant"}},
        )
        assert matched is False
        assert (await db.execute(select(GitHubRepositoryORM))).scalars().all() == []
    await engine.dispose()
