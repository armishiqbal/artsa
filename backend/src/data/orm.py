"""SQLAlchemy ORM models for persistence layer."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.data.db import Base


class AlertORM(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    agent_id: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(512))
    message: Mapped[str] = mapped_column(Text)
    risk_score: Mapped[float] = mapped_column(Float, default=70.0)
    channel: Mapped[str] = mapped_column(String(32), default="WEBHOOK")
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    # WS-3.1: row-level org isolation.
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant", index=True)


class AlertRuleORM(Base):
    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant")
    risk_threshold: Mapped[float] = mapped_column(Float, default=70.0)
    channel: Mapped[str] = mapped_column(String(32), default="WEBHOOK")
    target_url: Mapped[str] = mapped_column(String(1024))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class ProviderORM(Base):
    """A user-registered LLM provider (any API key, any base URL, any model).

    ``api_key`` is stored encrypted with the platform SECRET_KEY
    (:mod:`src.utils.crypto`); ``name`` is the slug used as the
    ``X-ARTSA-Provider`` value when routing through the containment proxy.
    """

    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    provider_type: Mapped[str] = mapped_column(String(64), default="custom")
    api_key: Mapped[str] = mapped_column(Text)
    base_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class CustomIntegrationORM(Base):
    """A user-defined outbound connector (config-driven, no code deploys).

    ``secrets`` holds Fernet-encrypted values keyed by name (see
    :mod:`src.utils.crypto`), referenced from ``headers`` (and optionally
    ``payload_template``) via ``{{secret:name}}``. ``payload_template`` is a
    JSON text body with ``{{field}}`` placeholders resolved against the event
    payload at dispatch time.
    """

    __tablename__ = "custom_integrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # slug
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    method: Mapped[str] = mapped_column(String(8), default="POST")  # POST|PUT|PATCH
    target_url: Mapped[str] = mapped_column(String(1024))
    auth_type: Mapped[str] = mapped_column(String(16), default="none")  # none|bearer|basic|api_key
    headers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # values may embed {{secret:name}}
    payload_template: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON text with {{field}}
    event_types: Mapped[list[str]] = mapped_column(JSON, default=list)  # subset of alert|tool_call|proxy_call|session_action
    risk_threshold: Mapped[float] = mapped_column(Float, default=0.0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    retries: Mapped[int] = mapped_column(Integer, default=3)
    timeout: Mapped[float] = mapped_column(Float, default=10.0)
    secrets: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # {name: Fernet ciphertext}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    # WS-3.1: row-level org isolation.
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant", index=True)


class ToolCallEventORM(Base):
    __tablename__ = "tool_call_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    agent_id: Mapped[str] = mapped_column(String(255))
    tool_name: Mapped[str] = mapped_column(String(255))
    arguments: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    trace_id: Mapped[str] = mapped_column(String(255))
    response: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant")


class SessionORM(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(255))
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant")
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tool_call_count: Mapped[int] = mapped_column(Integer, default=0)
    max_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    containment_breaches: Mapped[int] = mapped_column(Integer, default=0)


class EventEvaluationORM(Base):
    __tablename__ = "event_evaluations"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    verdict: Mapped[str] = mapped_column(String(32), default="SAFE")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    recommended_action: Mapped[str] = mapped_column(String(32), default="NONE")
    flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    security_event_count: Mapped[int] = mapped_column(Integer, default=0)
    # WS-3.1: row-level org isolation.
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant", index=True)


class CampaignJobORM(Base):
    __tablename__ = "campaign_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(128))
    attack_profile: Mapped[str] = mapped_column(String(64))
    max_rounds: Mapped[int] = mapped_column(Integer, default=10)
    rounds_completed: Mapped[int] = mapped_column(Integer, default=0)
    request_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    summary_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    # WS-3.1: row-level org isolation.
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant", index=True)

class AgentORM(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant")
    name: Mapped[str] = mapped_column(String(255))
    agent_type: Mapped[str] = mapped_column(String(64), default="general")
    provider: Mapped[str] = mapped_column(String(64), default="")
    model: Mapped[str] = mapped_column(String(128), default="")
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="HEALTHY")
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    total_sessions: Mapped[int] = mapped_column(Integer, default=0)
    total_breaches: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class AgentBaselineORM(Base):
    __tablename__ = "agent_baselines"

    agent_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    baseline: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    # WS-3.1: row-level org isolation (agent_id PK retained; tenant-scoped
    # uniqueness is enforced at the repository layer).
    tenant_id: Mapped[str] = mapped_column(String(255), default="default_tenant", index=True)


class UserORM(Base):
    """Local email/password account. First registered user becomes admin."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    avatar: Mapped[str | None] = mapped_column(Text, default=None)
    phone: Mapped[str | None] = mapped_column(String(255), default=None)
    location: Mapped[str | None] = mapped_column(String(255), default=None)
    organization: Mapped[str | None] = mapped_column(String(255), default=None)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(16), default="admin")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
