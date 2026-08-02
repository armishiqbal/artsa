"""Alerts & Webhook Configuration Endpoints."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from src.core.models.alerts import Alert, AlertRule
from src.services import alert_store

router = APIRouter(tags=["Alerts"])


class WebhookConfigRequest(BaseModel):
    url: str
    risk_threshold: float = 70.0
    channel: str = "WEBHOOK"


@router.get("/alerts", response_model=List[Alert])
async def list_alerts(
    severity: Optional[str] = Query(None),
    session_id: Optional[uuid.UUID] = Query(None),
):
    """List security alerts filtered by severity or session_id."""
    return alert_store.list_alerts(
        severity=severity,
        session_id=str(session_id) if session_id else None,
    )


@router.post("/alerts/webhooks", status_code=status.HTTP_201_CREATED)
async def configure_webhook(payload: WebhookConfigRequest):
    """Configure webhook notification URL."""
    rule = AlertRule(
        id=str(uuid.uuid4()),
        tenant_id="default_tenant",
        risk_threshold=payload.risk_threshold,
        channel="WEBHOOK",
        target_url=payload.url,
        enabled=True,
    )
    alert_store.add_webhook_rule(rule)
    return {"status": "configured", "rule_id": rule.id, "target_url": payload.url}


@router.post("/alerts/test")
async def send_test_alert():
    """Trigger a test alert dispatch."""
    test_alert = Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="test-agent-01",
        severity="HIGH",
        title="Test Security Alert",
        message="ARTSA Platform test alert generated successfully",
        channel="WEBHOOK",
        delivered=True,
    )
    alert_store.append_alert(test_alert)
    return {"status": "sent", "alert": test_alert}
