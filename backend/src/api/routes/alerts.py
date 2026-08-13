"""Alerts & SIEM/SOAR Integration Configuration Endpoints (DB-persisted)."""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_db
from src.core.models.alerts import Alert, AlertRule
from src.services import alert_store
from src.services.alert_dispatcher import CHANNEL_LABELS, SUPPORTED_CHANNELS, dispatch_test_alert

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Alerts"])


class WebhookConfigRequest(BaseModel):
    url: str
    risk_threshold: float = 70.0
    channel: str = "WEBHOOK"


class IntegrationConfigRequest(BaseModel):
    channel: str = Field(..., description="WEBHOOK | SLACK | PAGERDUTY | SPLUNK | DATADOG | SENTINEL")
    target_url: str = ""
    risk_threshold: float = 70.0
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)


@router.get("/alerts", response_model=list[Alert])
async def list_alerts(
    severity: str | None = Query(None),
    session_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List security alerts filtered by severity or session_id."""
    # Fast path: in-memory hot store (always current, includes latest).
    alerts = alert_store.list_alerts(
        severity=severity,
        session_id=str(session_id) if session_id else None,
    )
    # Ensure any persisted alerts that arrived before this process started are
    # also visible (e.g. after a restart while the hot store was still empty).
    if not alerts:
        try:
            from src.data.repositories.alerts import AlertRepository

            repo = AlertRepository(db)
            alerts = await repo.list_alerts(
                severity=severity,
                session_id=str(session_id) if session_id else None,
            )
        except Exception:
            alerts = []
    return alerts


@router.get("/alerts/channels")
async def list_channels() -> dict[str, Any]:
    """List supported SIEM/SOAR channels and which are env-configured."""
    from src.services.alert_dispatcher import env_integration_rules

    env_rules = env_integration_rules()
    return {
        "channels": [
            {
                "code": code,
                "label": CHANNEL_LABELS.get(code, code),
                "env_configured": any(r.channel == code for r in env_rules),
            }
            for code in SUPPORTED_CHANNELS
        ],
        "env_configured": sorted({r.id for r in env_rules}),
    }


@router.get("/alerts/integrations")
async def list_integrations(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """List all configured alert integrations (environment + persisted rules)."""
    from src.data.repositories.alerts import AlertRuleRepository
    from src.services.alert_dispatcher import env_integration_rules

    env_rules = env_integration_rules()
    persisted = alert_store.get_webhook_rules()
    if not persisted:
        try:
            repo = AlertRuleRepository(db)
            persisted = await repo.list_rules()
            alert_store.seed_webhook_rules(persisted)
        except Exception:
            persisted = []

    rules = env_rules + persisted
    return {
        "total": len(rules),
        "integrations": [
            {
                "id": r.id,
                "channel": r.channel,
                "label": CHANNEL_LABELS.get(r.channel, r.channel),
                "target_url": r.target_url,
                "risk_threshold": r.risk_threshold,
                "enabled": r.enabled,
                "config": r.config,
                "source": "environment" if r.config.get("source") == "environment" else "database",
            }
            for r in rules
        ],
    }


@router.post("/alerts/integrations", status_code=status.HTTP_201_CREATED)
async def create_integration(payload: IntegrationConfigRequest, db: AsyncSession = Depends(get_db)):
    """Configure a SIEM/SOAR alert integration (persisted to DB)."""
    channel = payload.channel.upper()
    if channel not in SUPPORTED_CHANNELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported channel '{channel}'. Supported: {', '.join(SUPPORTED_CHANNELS)}",
        )
    rule = AlertRule(
        id=str(uuid.uuid4()),
        tenant_id="default_tenant",
        risk_threshold=payload.risk_threshold,
        channel=channel,
        target_url=payload.target_url,
        enabled=payload.enabled,
        config=payload.config,
    )
    alert_store.add_webhook_rule(rule)
    await alert_store.persist_webhook_rule(db, rule)
    return {
        "status": "configured",
        "rule_id": rule.id,
        "channel": channel,
        "target_url": payload.target_url,
    }


@router.post("/alerts/integrations/{rule_id}/test")
async def test_integration(rule_id: str, db: AsyncSession = Depends(get_db)):
    """Dispatch a synthetic test alert through the given integration."""
    rule = next((r for r in alert_store.get_webhook_rules() if r.id == rule_id), None)
    if rule is None:
        try:
            from src.data.repositories.alerts import AlertRuleRepository

            repo = AlertRuleRepository(db)
            rule = next((r for r in await repo.list_rules() if r.id == rule_id), None)
        except Exception:
            rule = None
    if rule is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    return dispatch_test_alert(rule)


@router.delete("/alerts/integrations/{rule_id}")
async def delete_integration(rule_id: str, db: AsyncSession = Depends(get_db)):
    """Remove a persisted alert integration rule."""
    rules = alert_store.get_webhook_rules()
    remaining = [r for r in rules if r.id != rule_id]
    if len(remaining) == len(rules):
        raise HTTPException(status_code=404, detail="Integration not found")

    alert_store.seed_webhook_rules(remaining)
    try:
        from sqlalchemy import delete as sa_delete

        from src.data.orm import AlertRuleORM

        async with db.begin():
            await db.execute(sa_delete(AlertRuleORM).where(AlertRuleORM.id == rule_id))
    except Exception as exc:
        logger.warning("Failed to delete alert rule %s: %s", rule_id, exc)
    return {"status": "deleted", "rule_id": rule_id}


@router.post("/alerts/webhooks", status_code=status.HTTP_201_CREATED)
async def configure_webhook(payload: WebhookConfigRequest, db: AsyncSession = Depends(get_db)):
    """Configure webhook notification URL (persisted to DB)."""
    rule = AlertRule(
        id=str(uuid.uuid4()),
        tenant_id="default_tenant",
        risk_threshold=payload.risk_threshold,
        channel="WEBHOOK",
        target_url=payload.url,
        enabled=True,
    )
    alert_store.add_webhook_rule(rule)
    await alert_store.persist_webhook_rule(db, rule)
    return {"status": "configured", "rule_id": rule.id, "target_url": payload.url}


@router.post("/alerts/test")
async def send_test_alert(db: AsyncSession = Depends(get_db)):
    """Trigger a test alert dispatch (persisted to DB)."""
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
    await alert_store.persist_alert(db, test_alert)
    return {"status": "sent", "alert": test_alert}
