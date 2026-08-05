"""Pydantic models for the Agentic Risk Framework API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SeverityLabel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class AgenticRiskRow(BaseModel):
    id: str
    rank: int
    name: str
    description: str
    attack_categories: list[str]
    defense_layers: list[str]
    detectors: list[str]
    mitigations: list[str]
    live_events: int = Field(ge=0)
    blocked_events: int = Field(ge=0)
    breached_events: int = Field(ge=0)
    max_risk_score: float = Field(ge=0.0, le=100.0)
    severity: SeverityLabel


class RiskFrameworkResponse(BaseModel):
    framework: list[AgenticRiskRow]
    total_events: int = Field(ge=0)
    generated_at: str | None = None
