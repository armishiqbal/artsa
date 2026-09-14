"""Regression coverage for tenant-scoped provider migration on existing SQLite DBs."""

from __future__ import annotations

import asyncio
import sqlite3

from src.core.config import settings


def test_init_db_replaces_legacy_global_provider_name_index(monkeypatch, tmp_path):
    """Existing installations must permit the same provider alias per tenant."""
    database = tmp_path / "legacy.sqlite"
    with sqlite3.connect(database) as connection:
        connection.execute(
            """
            CREATE TABLE providers (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(64) NOT NULL,
                provider_type VARCHAR(64) NOT NULL,
                api_key TEXT NOT NULL,
                base_url VARCHAR(1024),
                default_model VARCHAR(128),
                enabled BOOLEAN NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )
            """
        )
        connection.execute("CREATE UNIQUE INDEX ix_providers_name ON providers (name)")
        connection.execute(
            """
            CREATE TABLE tool_call_events (
                id VARCHAR(36) PRIMARY KEY,
                session_id VARCHAR(36) NOT NULL,
                agent_id VARCHAR(255) NOT NULL,
                tool_name VARCHAR(255) NOT NULL,
                arguments JSON NOT NULL,
                timestamp DATETIME NOT NULL,
                trace_id VARCHAR(255) NOT NULL,
                response JSON,
                latency_ms FLOAT,
                tenant_id VARCHAR(255) NOT NULL DEFAULT 'default_tenant'
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE runtime_enforcement_audit (
                id VARCHAR(36) PRIMARY KEY,
                session_id VARCHAR(36) NOT NULL,
                stream BOOLEAN NOT NULL DEFAULT 0,
                action VARCHAR(32) NOT NULL,
                body_sha256 VARCHAR(64) NOT NULL,
                findings JSON NOT NULL DEFAULT '[]',
                created_at DATETIME NOT NULL
            )
            """
        )

    database_url = f"sqlite+aiosqlite:///{database}"
    monkeypatch.setattr(settings, "DATABASE_URL", database_url)
    monkeypatch.setattr(settings, "SYNC_DATABASE_URL", f"sqlite:///{database}")

    import src.data.db as db

    monkeypatch.setattr(db, "_engine", None)
    monkeypatch.setattr(db, "_session_factory", None)
    try:
        asyncio.run(db.init_db())
        with sqlite3.connect(database) as connection:
            indexes = {row[1] for row in connection.execute("PRAGMA index_list(providers)")}
            assert "ix_providers_name" not in indexes
            assert "uq_providers_tenant_name" in indexes
            tool_event_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(tool_call_events)")
            }
            assert {"post_exec_redacted", "response_sha256", "response_findings"} <= tool_event_columns
            audit_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(runtime_enforcement_audit)")
            }
            assert {
                "correlation_id",
                "tenant_id",
                "actor_id",
                "agent_id",
                "provider_id",
                "model",
                "latency_ms",
            } <= audit_columns
            connection.execute(
                """
                INSERT INTO providers
                    (id, tenant_id, name, provider_type, api_key, enabled, created_at, updated_at)
                VALUES ('a', 'tenant-a', 'shared', 'groq', 'ciphertext-a', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            )
            connection.execute(
                """
                INSERT INTO providers
                    (id, tenant_id, name, provider_type, api_key, enabled, created_at, updated_at)
                VALUES ('b', 'tenant-b', 'shared', 'groq', 'ciphertext-b', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            )
    finally:
        engine = db._engine
        if engine is not None:
            asyncio.run(engine.dispose())
