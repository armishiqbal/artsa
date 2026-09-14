"""Versioned, redaction-safe contracts for ARTSA managed MCP actions.

These contracts are deliberately separate from raw JSON-RPC.  They are the
stable boundary persisted by the runtime gateway and returned to operators;
payload bodies, credentials and model text never appear here.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class ActionOutcome(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"
    UNAVAILABLE = "UNAVAILABLE"


class ActionRequest(BaseModel):
    """The digest-only action identity shared by gateway, evidence and UI."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    action_id: UUID = Field(default_factory=uuid4)
    tenant_id: str = Field(min_length=1, max_length=255)
    session_id: UUID
    trace_id: str = Field(min_length=1, max_length=255)
    agent_id: str = Field(min_length=1, max_length=255)
    actor_id: str | None = Field(default=None, max_length=255)
    integration: Literal["github"]
    github_installation_id: str = Field(min_length=1, max_length=255)
    tool: str = Field(min_length=1, max_length=128)
    resource: str = Field(min_length=1, max_length=512)
    operation: str = Field(min_length=1, max_length=128)
    arguments_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_trust: Literal["trusted", "untrusted", "mixed"] = "untrusted"
    data_classification: Literal["public", "internal", "confidential", "restricted"] = "internal"
    policy_version: str = Field(min_length=1, max_length=128)
    requested_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ActionDecision(BaseModel):
    """Terminal decision without sensitive request or response material."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1] = 1
    action_id: UUID
    outcome: ActionOutcome
    reason_codes: list[str] = Field(default_factory=list, max_length=20)
    finding_categories: list[str] = Field(default_factory=list, max_length=20)
    detector_version: str
    policy_version: str
    evidence_id: UUID
    # Safe correlation only. The retry credential itself is never returned in
    # this contract; operators use this identifier to locate the approval row.
    approval_id: str | None = Field(default=None, max_length=36)
    latency_ms: int = Field(ge=0)
    expires_at: datetime | None = None
