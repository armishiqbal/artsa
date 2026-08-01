"""Pydantic v2 Agent and Agent Baseline Models."""

from datetime import datetime, timezone
from typing import Dict, List, Literal
from pydantic import BaseModel, Field, ConfigDict


class Agent(BaseModel):
    """Model representing an AI agent registered in the platform."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str = "default_tenant"
    name: str
    status: Literal["HEALTHY", "AT_RISK", "BREACHED", "QUARANTINED"] = "HEALTHY"
    last_seen: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_sessions: int = 0
    total_breaches: int = 0


class AgentBaseline(BaseModel):
    """Model representing learned behavioral baseline for an AI agent."""

    model_config = ConfigDict(from_attributes=True)

    agent_id: str
    tool_frequency: Dict[str, float] = Field(default_factory=dict)
    common_file_paths: List[str] = Field(default_factory=list)
    avg_session_duration: float = 0.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
