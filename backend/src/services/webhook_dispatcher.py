"""Deliver alerts to configured webhook endpoints."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from src.core.models.alerts import Alert
from src.services import alert_store

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
TIMEOUT_SEC = 10.0


def _build_payload(alert: Alert) -> dict[str, Any]:
    return {
        "id": str(alert.id),
        "session_id": str(alert.session_id),
        "agent_id": alert.agent_id,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "channel": alert.channel,
        "triggered_at": alert.triggered_at.isoformat(),
    }


def dispatch_alert_webhooks(alert: Alert) -> bool:
    """POST alert to all enabled webhook rules above risk threshold. Returns True if any delivered."""
    rules = [r for r in alert_store.get_webhook_rules() if r.enabled and r.channel == "WEBHOOK"]
    if not rules:
        return False

    risk = 70.0
    if "risk" in alert.message.lower():
        try:
            risk = float(alert.message.split("risk")[1].split("·")[0].strip())
        except (IndexError, ValueError):
            pass

    delivered_any = False
    payload = _build_payload(alert)

    for rule in rules:
        if risk < rule.risk_threshold:
            continue
        url = rule.target_url.strip()
        if not url:
            continue

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=TIMEOUT_SEC) as client:
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                logger.info("Webhook delivered alert %s to %s", alert.id, url)
                delivered_any = True
                break
            except Exception as exc:
                logger.warning(
                    "Webhook attempt %s/%s failed for %s: %s",
                    attempt,
                    MAX_RETRIES,
                    url,
                    exc,
                )

    if delivered_any:
        alert_store.mark_delivered(alert.id)
    return delivered_any
