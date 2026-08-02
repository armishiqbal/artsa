"""In-memory alert store populated from live ingest events."""

from __future__ import annotations

import uuid
from typing import List, Optional

from src.core.models.alerts import Alert, AlertRule

_alerts_store: List[Alert] = []
_webhook_rules: List[AlertRule] = []
_MAX_ALERTS = 500


def list_alerts(
    severity: Optional[str] = None,
    session_id: Optional[str] = None,
) -> List[Alert]:
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
        from src.services.webhook_dispatcher import dispatch_alert_webhooks

        dispatch_alert_webhooks(alert)
    except Exception:
        pass

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
) -> Optional[Alert]:
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


def get_webhook_rules() -> List[AlertRule]:
    return _webhook_rules


def add_webhook_rule(rule: AlertRule) -> AlertRule:
    _webhook_rules.append(rule)
    return rule
