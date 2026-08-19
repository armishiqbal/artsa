"""Pydantic v2 Alert & Alert Rule Models."""

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Alert(BaseModel):
    """Model representing a triggered alert dispatch."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID
    agent_id: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    title: str
    message: str
    risk_score: float = 70.0
    channel: Literal["WEBHOOK", "SLACK", "PAGERDUTY", "EMAIL", "SPLUNK", "DATADOG", "SENTINEL"]
    triggered_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    delivered: bool = False
    # WS-3.3 incident workflow: NEW → ACKNOWLEDGED → RESOLVED.
    status: Literal["NEW", "ACKNOWLEDGED", "RESOLVED"] = "NEW"
    # WS-3.1: owning tenant for row-level isolation.
    tenant_id: str = "default_tenant"


class AlertRule(BaseModel):
    """Model representing alert routing & threshold configuration."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str = "default_tenant"
    risk_threshold: float = 70.0
    channel: Literal["WEBHOOK", "SLACK", "PAGERDUTY", "EMAIL", "SPLUNK", "DATADOG", "SENTINEL"]
    target_url: str
    enabled: bool = True
    # Channel-specific settings, e.g. {"channel": "#security", "severity": "critical",
    # "index": "artsa", "datadog_site": "datadoghq.eu", "pagerduty_routing_key": "..."}
    config: dict[str, Any] = Field(default_factory=dict)
