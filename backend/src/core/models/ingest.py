"""Pydantic models for ingest enforcement responses."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class IngestRiskScore(BaseModel):
    overall_score: float = Field(ge=0.0, le=100.0)
    flags: list[str] = Field(default_factory=list)


class IngestVerdict(BaseModel):
    verdict: Literal["SAFE", "SUSPICIOUS", "BREACHED", "ESCALATED"]
    confidence: float = Field(ge=0.0, le=1.0)
    recommended_action: Literal["NONE", "ALERT", "THROTTLE", "KILL", "QUARANTINE"]
    reasoning: str = ""


class IngestEvaluation(BaseModel):
    event_id: str
    tool_name: str
    risk_score: float
    verdict: str
    confidence: float
    recommended_action: str
    reasoning: str = ""
    flags: list[str] = Field(default_factory=list)
    rule_based_score: float = 0.0
    statistical_score: float = 0.0
    semantic_score: float = 0.0
    goal_drift_score: float = 0.0
    injection_score: float = 0.0
    trajectory_score: float = 0.0
    tool_output_score: float = 0.0
    canary_score: float = 0.0
    sql_injection_score: float = 0.0
    mcp_destructive_score: float = 0.0
    bypass_depth: int = 0
    security_event_count: int = 0
    enforced: bool = False


class IngestResponse(BaseModel):
    ingested: int
    session_id: str
    timestamp: str
    risk_score: IngestRiskScore
    verdict: IngestVerdict
    evaluations: list[IngestEvaluation]
    session_status: str | None = None
    auto_enforced_action: str | None = None
    extras: dict[str, Any] = Field(default_factory=dict)
