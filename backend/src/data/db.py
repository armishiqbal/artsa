"""Async SQLAlchemy engine and session factory."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from src.core.config import settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        url = settings.effective_database_url
        if url.startswith("sqlite:///") and not url.startswith("sqlite+aiosqlite"):
            url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        if "sqlite" in url:
            db_path = url.split("///")[-1]
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        _engine = create_async_engine(url, echo=False)
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db() -> None:
    from src.data.orm import (  # noqa: F401
        AlertORM,
        AlertRuleORM,
        ApprovalRequestORM,
        CampaignJobORM,
        CustomIntegrationORM,
        EventEvaluationORM,
        GitHubInstallationORM,
        GitHubRepositoryORM,
        HmacHandoffAuditORM,
        MCPActionEvidenceORM,
        PartnerApiKeyORM,
        PlaygroundRunAuditORM,
        ProviderORM,
        RuntimeEnforcementAuditORM,
        SessionORM,
        TargetORM,
        ToolCallEventORM,
        UserORM,
    )

    engine = get_engine()
    async with engine.begin() as conn:
        # Lightweight dev upgrade: SQLite DBs created before newer columns
        # existed (create_all can't ALTER existing tables) get them added here.
        # Postgres installs should use `alembic upgrade head` instead.
        if "sqlite" in settings.effective_database_url:
            tables = [
                row[0]
                for row in await conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                )
            ]
            if "alert_rules" in tables:
                alert_cols = [row[1] for row in await conn.execute(text("PRAGMA table_info(alert_rules)"))]
                if "config" not in alert_cols:
                    await conn.execute(text("ALTER TABLE alert_rules ADD COLUMN config JSON DEFAULT '{}'"))
                if "tenant_id" not in alert_cols:
                    await conn.execute(text("ALTER TABLE alert_rules ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default_tenant'"))
            if "users" in tables:
                cols = [row[1] for row in await conn.execute(text("PRAGMA table_info(users)"))]
                if "avatar" not in cols:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN avatar TEXT"))
                # Profile fields added after the avatar column — SQLite ignores
                # VARCHAR length, so the original avatar VARCHAR(16) needs no ALTER.
                for col in ("phone", "location", "organization"):
                    if col not in cols:
                        await conn.execute(
                            text(f"ALTER TABLE users ADD COLUMN {col} VARCHAR(255)")
                        )
                if "tenant_id" not in cols:
                    # WS-3.1 hardening: identity -> tenant binding.
                    await conn.execute(text("ALTER TABLE users ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default_org'"))
            if "alerts" in tables:
                cols = [row[1] for row in await conn.execute(text("PRAGMA table_info(alerts)"))]
                if "risk_score" not in cols:
                    await conn.execute(text("ALTER TABLE alerts ADD COLUMN risk_score FLOAT NOT NULL DEFAULT 70.0"))
                if "tenant_id" not in cols:
                    await conn.execute(text("ALTER TABLE alerts ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default_tenant'"))
                if "status" not in cols:
                    # WS-3.3 incident workflow: NEW | ACKNOWLEDGED | RESOLVED.
                    await conn.execute(text("ALTER TABLE alerts ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'NEW'"))
            if "providers" in tables:
                cols = [row[1] for row in await conn.execute(text("PRAGMA table_info(providers)"))]
                if "tenant_id" not in cols:
                    await conn.execute(text("ALTER TABLE providers ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default_org'"))
                # Early ARTSA installations made ``providers.name`` globally
                # unique.  That silently defeats the tenant-scoped provider
                # contract: tenant B cannot register the same local alias as
                # tenant A.  ``create_all`` cannot alter an existing SQLite
                # index, so repair the development schema explicitly.
                indexes = [
                    row[1]
                    for row in await conn.execute(text("PRAGMA index_list(providers)"))
                ]
                if "ix_providers_name" in indexes:
                    await conn.execute(text("DROP INDEX ix_providers_name"))
                await conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS "
                        "uq_providers_tenant_name ON providers (tenant_id, name)"
                    )
                )

            # Phase 2.5 added digest-only post-execution evidence to tool
            # events.  Existing local SQLite databases need an explicit ALTER
            # because metadata.create_all() does not evolve an old table.
            # Defaults ensure historical rows remain valid and no raw result
            # body is manufactured during migration.
            if "tool_call_events" in tables:
                tool_event_cols = [
                    row[1]
                    for row in await conn.execute(text("PRAGMA table_info(tool_call_events)"))
                ]
                if "post_exec_redacted" not in tool_event_cols:
                    await conn.execute(
                        text(
                            "ALTER TABLE tool_call_events "
                            "ADD COLUMN post_exec_redacted BOOLEAN NOT NULL DEFAULT 0"
                        )
                    )
                if "response_sha256" not in tool_event_cols:
                    await conn.execute(
                        text(
                            "ALTER TABLE tool_call_events "
                            "ADD COLUMN response_sha256 VARCHAR(64)"
                        )
                    )
                if "response_findings" not in tool_event_cols:
                    await conn.execute(
                        text(
                            "ALTER TABLE tool_call_events "
                            "ADD COLUMN response_findings JSON NOT NULL DEFAULT '[]'"
                        )
                    )

            if "hmac_handoff_audit" in tables:
                hmac_cols = [
                    row[1]
                    for row in await conn.execute(text("PRAGMA table_info(hmac_handoff_audit)"))
                ]
                if "nonce" in hmac_cols and "nonce_sha256" not in hmac_cols:
                    await conn.execute(
                        text(
                            "ALTER TABLE hmac_handoff_audit RENAME COLUMN nonce TO nonce_sha256"
                        )
                    )
                    hmac_cols = [
                        row[1]
                        for row in await conn.execute(text("PRAGMA table_info(hmac_handoff_audit)"))
                    ]
                if "event_id" not in hmac_cols:
                    await conn.execute(
                        text(
                            "ALTER TABLE hmac_handoff_audit ADD COLUMN event_id VARCHAR(64) NOT NULL DEFAULT ''"
                        )
                    )
                    await conn.execute(
                        text(
                            "UPDATE hmac_handoff_audit SET event_id = id WHERE event_id = '' OR event_id IS NULL"
                        )
                    )
            if "mcp_action_evidence" in tables:
                mcp_evidence_cols = [
                    row[1]
                    for row in await conn.execute(text("PRAGMA table_info(mcp_action_evidence)"))
                ]
                if "github_installation_id" not in mcp_evidence_cols:
                    # Old development evidence predates managed GitHub actions;
                    # its rows cannot claim an installation binding.
                    await conn.execute(
                        text(
                            "ALTER TABLE mcp_action_evidence "
                            "ADD COLUMN github_installation_id VARCHAR(255) NOT NULL DEFAULT 'legacy-unbound'"
                        )
                    )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_mcp_action_evidence_github_installation "
                        "ON mcp_action_evidence (github_installation_id)"
                    )
                )
                for column, definition in (
                    ("execution_state", "VARCHAR(32) NOT NULL DEFAULT 'PENDING'"),
                    ("result_sha256", "VARCHAR(64)"),
                    ("execution_latency_ms", "INTEGER"),
                    ("execution_findings", "JSON NOT NULL DEFAULT '[]'"),
                    ("executed_at", "DATETIME"),
                    ("github_issue_number", "INTEGER"),
                    ("reconciled_at", "DATETIME"),
                ):
                    if column not in mcp_evidence_cols:
                        await conn.execute(
                            text(f"ALTER TABLE mcp_action_evidence ADD COLUMN {column} {definition}")
                        )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_mcp_action_evidence_execution_state "
                        "ON mcp_action_evidence (execution_state)"
                    )
                )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_mcp_action_evidence_github_issue_number "
                        "ON mcp_action_evidence (github_issue_number)"
                    )
                )
            tenant_tables = (
                "event_evaluations",
                "custom_integrations",
                "campaign_jobs",
                "agent_baselines",
                "tool_call_events",
                "agent_sessions",
                "agents",
            )
            for tbl in tenant_tables:
                if tbl in tables:
                    cols = [row[1] for row in await conn.execute(text(f"PRAGMA table_info({tbl})"))]
                    if "tenant_id" not in cols:
                        await conn.execute(
                            text(f"ALTER TABLE {tbl} ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default_tenant'")
                        )
            if "runtime_enforcement_audit" in tables:
                audit_cols = [
                    row[1]
                    for row in await conn.execute(text("PRAGMA table_info(runtime_enforcement_audit)"))
                ]
                audit_new_cols = [
                    ("correlation_id", "VARCHAR(64)"),
                    ("tenant_id", "VARCHAR(255)"),
                    ("actor_id", "VARCHAR(255)"),
                    ("agent_id", "VARCHAR(255)"),
                    ("provider_id", "VARCHAR(64)"),
                    ("model", "VARCHAR(255)"),
                    ("latency_ms", "INTEGER"),
                ]
                for col_name, col_type in audit_new_cols:
                    if col_name not in audit_cols:
                        await conn.execute(
                            text(f"ALTER TABLE runtime_enforcement_audit ADD COLUMN {col_name} {col_type}")
                        )
        await conn.run_sync(Base.metadata.create_all)
