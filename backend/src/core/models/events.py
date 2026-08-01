"""Pydantic v2 Event Models."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


class ToolCallEvent(BaseModel):
    """Event model representing an individual tool execution by an AI agent."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    agent_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    response: Optional[Dict[str, Any]] = None
    latency_ms: Optional[float] = None


class SecurityEvent(BaseModel):
    """Event model representing a detected containment risk or anomaly."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    agent_id: str
    event_type: Literal[
        "PROMPT_INJECTION",
        "JAILBREAK",
        "CREDENTIAL_THEFT",
        "REVERSE_SHELL",
        "EGRESS_TUNNEL",
        "PRIVILEGE_ESCALATION",
        "GOAL_DRIFT",
        "SANDBOX_ESCAPE"
    ]
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    risk_score: float = Field(ge=0.0, le=100.0)
    description: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    detector: str
