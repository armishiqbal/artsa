"""Pydantic v2 Risk Scoring and Verdict Models."""

import uuid
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RiskScore(BaseModel):
    """Model representing multi-detector containment risk score breakdown."""

    model_config = ConfigDict(from_attributes=True)

    session_id: uuid.UUID
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    overall_score: float = Field(ge=0.0, le=100.0)
    rule_based_score: float = Field(default=0.0, ge=0.0, le=100.0)
    statistical_score: float = Field(default=0.0, ge=0.0, le=100.0)
    semantic_score: float = Field(default=0.0, ge=0.0, le=100.0)
    goal_drift_score: float = Field(default=0.0, ge=0.0, le=100.0)
    injection_score: float = Field(default=0.0, ge=0.0, le=100.0)
    trajectory_score: float = Field(default=0.0, ge=0.0, le=100.0)
    tool_output_score: float = Field(default=0.0, ge=0.0, le=100.0)
    canary_score: float = Field(default=0.0, ge=0.0, le=100.0)
    sql_injection_score: float = Field(default=0.0, ge=0.0, le=100.0)
    mcp_destructive_score: float = Field(default=0.0, ge=0.0, le=100.0)
    bypass_depth: int = Field(default=0, ge=0, le=5)
    flags: list[str] = Field(default_factory=list)


class ContainmentVerdict(BaseModel):
    """Model representing final containment verdict and enforcement recommendation."""

    model_config = ConfigDict(from_attributes=True)

    session_id: uuid.UUID
    verdict: Literal["SAFE", "SUSPICIOUS", "BREACHED", "ESCALATED"] = "SAFE"
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    recommended_action: Literal["NONE", "ALERT", "THROTTLE", "KILL", "QUARANTINE"] = "NONE"
