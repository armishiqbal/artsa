"""Alert store with in-memory hot path + durable DB persistence.

Alerts and webhook rules are kept in-process for instant reads (WebSocket
inbox, alert routes) AND persisted to the database so they survive restarts.
Persistence runs through AlertRepository / AlertRuleRepository; the async
``persist_*`` helpers are called by the API routes that own a DB session.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models.alerts import Alert, AlertRule
from src.data.repositories.alerts import AlertRepository, AlertRuleRepository

logger = logging.getLogger(__name__)

_alerts_store: list[Alert] = []
_webhook_rules: list[AlertRule] = []
_MAX_ALERTS = 500


# ─────────────────────────────────────────────────────────────────────────────
# In-memory hot path (instant reads, WebSocket inbox, sync call sites)
# ─────────────────────────────────────────────────────────────────────────────

def list_alerts(
    severity: str | None = None,
    session_id: str | None = None,
) -> list[Alert]:
    results = _alerts_store
    if severity:
        results = [a for a in results if a.severity == severity]
    if session_id:
        results = [a for a in results if str(a.session_id) == session_id]
    return results


def append_alert(alert: Alert) -> Alert:
    _alerts_store.insert(0, alert)
    del _alerts_store[_MAX_ALERTS:]

    try:
        from src.services.alert_dispatcher import dispatch_alert

        dispatch_alert(alert)
    except Exception as exc:
        logger.warning("Alert dispatch failed for %s: %s", alert.id, exc)

    return alert


def mark_delivered(alert_id: uuid.UUID) -> None:
    for alert in _alerts_store:
        if alert.id == alert_id:
            alert.delivered = True
            break


def record_alert_from_evaluation(
    *,
    session_id: uuid.UUID,
    agent_id: str,
    tool_name: str,
    risk_score: float,
    verdict: str,
    recommended_action: str,
) -> Alert | None:
    """Create an alert when risk crosses HIGH/CRITICAL thresholds."""
    if risk_score < 60:
        return None

    severity = "CRITICAL" if risk_score >= 80 else "HIGH"
    title = f"{verdict} on {tool_name}"
    message = (
        f"Agent {agent_id} · risk {risk_score:.1f} · "
        f"recommended {recommended_action}"
    )

    alert = Alert(
        id=uuid.uuid4(),
        session_id=session_id,
        agent_id=agent_id,
        severity=severity,
        title=title,
        message=message,
        channel="WEBHOOK",
        delivered=False,
    )
    return append_alert(alert)


def get_webhook_rules() -> list[AlertRule]:
    return _webhook_rules


def add_webhook_rule(rule: AlertRule) -> AlertRule:
    _webhook_rules.append(rule)
    return rule


def seed_webhook_rules(rules: list[AlertRule]) -> None:
    """Load persisted rules into memory (called on startup / after writes)."""
    _webhook_rules[:] = rules


def load_persisted_alerts(alerts: list[Alert]) -> None:
    """Load persisted alerts into the in-memory hot path (startup)."""
    _alerts_store[:] = alerts[:_MAX_ALERTS]


# ─────────────────────────────────────────────────────────────────────────────
# Durable persistence helpers (called by async API routes with a DB session)
# ─────────────────────────────────────────────────────────────────────────────

async def persist_alert(db: AsyncSession, alert: Alert) -> Alert:
    """Persist an alert to the database (no-op safe if DB is unavailable)."""
    try:
        repo = AlertRepository(db)
        return await repo.create_alert(alert)
    except Exception:
        return alert


async def persist_alert_delivered(db: AsyncSession, alert_id: uuid.UUID) -> None:
    try:
        repo = AlertRepository(db)
        await repo.mark_delivered(alert_id)
    except Exception as exc:
        logger.warning("Failed to mark alert %s delivered: %s", alert_id, exc)


async def persist_webhook_rule(db: AsyncSession, rule: AlertRule) -> AlertRule:
    try:
        repo = AlertRuleRepository(db)
        stored = await repo.upsert_rule(rule)
        seed_webhook_rules(await repo.list_rules())
        return stored
    except Exception:
        return rule


async def load_persisted_state(db: AsyncSession) -> None:
    """Load alerts + webhook rules from the DB into memory. Call at startup."""
    try:
        alert_repo = AlertRepository(db)
        rule_repo = AlertRuleRepository(db)
        load_persisted_alerts(await alert_repo.list_alerts())
        seed_webhook_rules(await rule_repo.list_rules())
    except Exception as exc:
        logger.warning("Failed to load persisted alert state: %s", exc)
