"""Pydantic v2 Alert & Alert Rule Models."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Literal
from pydantic import BaseModel, Field, ConfigDict


class Alert(BaseModel):
    """Model representing a triggered alert dispatch."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    agent_id: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    title: str
    message: str
    channel: Literal["WEBHOOK", "SLACK", "PAGERDUTY", "EMAIL"]
    triggered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    delivered: bool = False


class AlertRule(BaseModel):
    """Model representing alert routing & threshold configuration."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str = "default_tenant"
    risk_threshold: float = 70.0
    channel: Literal["WEBHOOK", "SLACK", "PAGERDUTY", "EMAIL"]
    target_url: str
    enabled: bool = True
