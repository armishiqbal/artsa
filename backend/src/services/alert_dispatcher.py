"""Multi-channel SIEM / SOAR alert dispatcher.

Delivers containment alerts to enterprise security hubs:

* Slack (incoming webhooks)
* PagerDuty (Events API v2)
* Splunk (HTTP Event Collector)
* Datadog (Logs intake API v2)
* Microsoft Sentinel (Log Analytics Data Collector API)
* Generic Webhooks (existing behavior)

Channel credentials come from environment settings (global integration) or
per-rule ``config`` (tenant-scoped). Rules are stored via the ``AlertRule``
model and surfaced through the alerts API.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import queue
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

import httpx

from src.core.config import settings
from src.core.models.alerts import Alert, AlertRule
from src.services import alert_store

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
TIMEOUT_SEC = 10.0

SUPPORTED_CHANNELS: tuple[str, ...] = (
    "WEBHOOK",
    "SLACK",
    "PAGERDUTY",
    "SPLUNK",
    "DATADOG",
    "SENTINEL",
)

CHANNEL_LABELS: dict[str, str] = {
    "WEBHOOK": "Generic Webhook",
    "SLACK": "Slack",
    "PAGERDUTY": "PagerDuty",
    "SPLUNK": "Splunk (HEC)",
    "DATADOG": "Datadog Logs",
    "SENTINEL": "Microsoft Sentinel",
    "EMAIL": "Email",
}

_NL = chr(10)


# ─────────────────────────────────────────────────────────────────────────────
# Payload builders (pure functions — unit-testable)
# ─────────────────────────────────────────────────────────────────────────────


def _base_fields(alert: Alert) -> dict[str, Any]:
    return {
        "id": str(alert.id),
        "session_id": str(alert.session_id),
        "agent_id": alert.agent_id,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "risk_score": alert.risk_score,
        "channel": alert.channel,
        "triggered_at": alert.triggered_at.isoformat(),
    }


def build_slack_payload(alert: Alert, rule: AlertRule) -> dict[str, Any]:
    severity_color = {"LOW": "#7cb342", "MEDIUM": "#fb8c00", "HIGH": "#e53935", "CRITICAL": "#b71c1c"}
    channel = rule.config.get("channel") or "#security"
    risk = alert.risk_score
    return {
        "channel": channel,
        "username": "ARTSA Containment",
        "icon_emoji": ":shield:",
        "attachments": [
            {
                "color": severity_color.get(alert.severity, "#e53935"),
                "fallback": alert.title,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f":rotating_light: {alert.title} ({alert.severity})",
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Agent:* {alert.agent_id}"},
                            {"type": "mrkdwn", "text": f"*Session:* {alert.session_id}"},
                            {"type": "mrkdwn", "text": f"*Risk:* {risk:.1f}/100"},
                            {"type": "mrkdwn", "text": f"*Time:* {alert.triggered_at.isoformat()}"},
                        ],
                    },
                    {"type": "section", "text": {"type": "mrkdwn", "text": alert.message}},
                    {"type": "context", "elements": [{"type": "mrkdwn", "text": "ARTSA AI Security Platform"}]},
                ],
            }
        ],
    }


def build_pagerduty_payload(alert: Alert, rule: AlertRule) -> dict[str, Any]:
    routing_key = rule.config.get("pagerduty_routing_key") or settings.PAGERDUTY_ROUTING_KEY or ""
    severity = rule.config.get("pagerduty_severity") or (
        "critical" if alert.severity in ("HIGH", "CRITICAL") else "warning"
    )
    risk = alert.risk_score
    return {
        "routing_key": routing_key,
        "event_action": "trigger",
        "dedup_key": str(alert.id),
        "payload": {
            "summary": f"[ARTSA] {alert.title}",
            "source": f"artsa-agent:{alert.agent_id}",
            "severity": severity,
            "timestamp": alert.triggered_at.isoformat(),
            "component": "ARTSA Containment",
            "group": "AI-Security",
            "class": "prompt_injection" if "injection" in alert.title.lower() else "containment",
            "custom_details": _base_fields(alert) | {"risk_score": risk},
        },
    }


def build_splunk_payload(alert: Alert, rule: AlertRule) -> dict[str, Any]:
    return {
        "event": _base_fields(alert) | {"risk_score": alert.risk_score},
        "sourcetype": "artsa:security:alert",
        "source": "artsa",
        "host": "artsa-platform",
        "index": rule.config.get("index") or "artsa_security",
        "time": int(alert.triggered_at.timestamp()),
    }


def build_datadog_payload(alert: Alert, rule: AlertRule) -> list[dict[str, Any]]:
    risk = alert.risk_score
    return [
        {
            "ddsource": "artsa",
            "service": "artsa-security",
            "host": "artsa-platform",
            "ddtags": f"severity:{alert.severity.lower()},risk:{risk:.1f},channel:containment",
            "date": alert.triggered_at.isoformat(),
            "message": f"{alert.title} — {alert.message}",
            "alert_id": str(alert.id),
            "session_id": str(alert.session_id),
            "agent_id": alert.agent_id,
        }
    ]


def build_sentinel_payload(alert: Alert, rule: AlertRule) -> dict[str, Any]:
    severity_map = {"LOW": 2, "MEDIUM": 3, "HIGH": 3, "CRITICAL": 4}
    return {
        "TimeGenerated": alert.triggered_at.isoformat(timespec="seconds"),
        "AlertId": str(alert.id),
        "Provider": "ARTSA",
        "ProviderVersion": "1.0",
        "Severity": severity_map.get(alert.severity, 3),
        "Title": alert.title,
        "Description": alert.message,
        "SessionId": str(alert.session_id),
        "AgentId": alert.agent_id,
        "RiskScore": alert.risk_score,
        "SourceSystem": "ARTSA",
    }


def sentinel_signature(workspace_id: str, shared_key: str, date: str, content_length: int) -> str:
    """Build the Authorization signature for the Log Analytics Data Collector API."""
    string_to_hash = (
        f"POST{_NL}{content_length}{_NL}application/json{_NL}x-ms-date:{date}{_NL}/api/logs"
    )
    decoded_key = base64.b64decode(shared_key)
    digest = hmac.new(decoded_key, string_to_hash.encode("utf-8"), hashlib.sha256).digest()
    encoded_hash = base64.b64encode(digest).decode("utf-8")
    return f"SharedKey {workspace_id}:{encoded_hash}"


# ─────────────────────────────────────────────────────────────────────────────
# Target resolution & dispatch
# ─────────────────────────────────────────────────────────────────────────────


def _channel_target(rule: AlertRule) -> tuple[str, dict[str, str]]:
    """Resolve (url, headers) for a rule's channel."""
    channel = rule.channel
    url = rule.target_url.strip()

    if channel == "WEBHOOK":
        return url or "", {}

    if channel == "SLACK":
        url = url or settings.SLACK_WEBHOOK_URL or ""
        return url, {}

    if channel == "PAGERDUTY":
        url = url or settings.PAGERDUTY_SERVICE_URL or "https://events.pagerduty.com/v2/enqueue"
        return url, {}

    if channel == "SPLUNK":
        url = url or settings.SPLUNK_HEC_URL or ""
        token = rule.config.get("splunk_hec_token") or settings.SPLUNK_HEC_TOKEN or ""
        return url, {"Authorization": f"Splunk {token}"}

    if channel == "DATADOG":
        site = rule.config.get("datadog_site") or settings.DATADOG_SITE or "datadoghq.com"
        url = url or f"https://http-intake.logs.{site}/api/v2/logs"
        api_key = rule.config.get("datadog_api_key") or settings.DATADOG_API_KEY or ""
        return url, {"DD-API-KEY": api_key}

    if channel == "SENTINEL":
        workspace_id = rule.config.get("sentinel_workspace_id") or settings.SENTINEL_WORKSPACE_ID or ""
        url = url or (
            f"https://{workspace_id}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01"
            if workspace_id
            else ""
        )
        return url, {}

    return "", {}


def _build_payload_for(alert: Alert, rule: AlertRule) -> Any:
    channel = rule.channel
    if channel == "WEBHOOK":
        return _base_fields(alert)
    if channel == "SLACK":
        return build_slack_payload(alert, rule)
    if channel == "PAGERDUTY":
        return build_pagerduty_payload(alert, rule)
    if channel == "SPLUNK":
        return build_splunk_payload(alert, rule)
    if channel == "DATADOG":
        return build_datadog_payload(alert, rule)
    if channel == "SENTINEL":
        return build_sentinel_payload(alert, rule)
    return _base_fields(alert)


def _dispatch_channel(alert: Alert, rule: AlertRule) -> bool:
    """POST a single alert to one configured channel with retries."""
    url, headers = _channel_target(rule)
    if not url:
        logger.warning("No target URL configured for %s rule %s", rule.channel, rule.id)
        return False

    payload = _build_payload_for(alert, rule)

    if rule.channel == "SENTINEL":
        workspace_id = rule.config.get("sentinel_workspace_id") or settings.SENTINEL_WORKSPACE_ID or ""
        shared_key = rule.config.get("sentinel_workspace_key") or settings.SENTINEL_WORKSPACE_KEY or ""
        log_type = rule.config.get("sentinel_log_type") or settings.SENTINEL_LOG_TYPE or "ARTSA_Security"
        date = datetime.now(UTC).strftime("%a, %d %b %Y %H:%M:%S GMT")
        body = json.dumps([payload]).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Log-Type": log_type,
            "x-ms-date": date,
            "Authorization": sentinel_signature(workspace_id, shared_key, date, len(body)),
        }
    else:
        body = json.dumps(payload).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=TIMEOUT_SEC) as client:
                response = client.post(url, content=body, headers=headers)
                response.raise_for_status()
            logger.info("Alert %s delivered to %s (%s)", alert.id, rule.channel, url)
            return True
        except Exception as exc:
            logger.warning(
                "%s attempt %s/%s failed for %s: %s",
                rule.channel,
                attempt,
                MAX_RETRIES,
                url,
                exc,
            )
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Background delivery worker (off the ingest hot path)
# ─────────────────────────────────────────────────────────────────────────────


class AlertDeliveryWorker:
    """Deliver alerts to built-in SIEM/SOAR channels off the ingest hot path.

    Mirrors :class:`src.services.custom_integration_dispatcher.CustomIntegrationWorker`:
    producers call non-blocking ``put_nowait``; a small thread pool owns the
    (potentially slow, retried) HTTP delivery so a stuck or slow channel never
    blocks an ingest request. ``delivered`` is marked per-channel on success.
    """

    def __init__(self, maxsize: int = 1000, workers: int = 2) -> None:
        self._queue: queue.Queue[tuple[Alert, AlertRule]] = queue.Queue(maxsize=maxsize)
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="alrt")
        self._workers = workers
        self._stop = threading.Event()
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._started = True
        self._stop.clear()
        self._futures = [self._pool.submit(self._consume) for _ in range(self._workers)]

    def stop(self, wait: bool = True) -> None:
        self._started = False
        self._stop.set()
        try:
            self._pool.shutdown(wait=wait, cancel_futures=False)
        except Exception as exc:  # pragma: no cover - already shut down
            logger.debug("Alert delivery worker shutdown error: %s", exc)

    def enqueue(self, alert: Alert, rule: AlertRule) -> bool:
        """Queue a (alert, rule) delivery. Returns False (drops) on a full queue."""
        if not self._started:
            return False
        try:
            self._queue.put_nowait((alert, rule))
            return True
        except queue.Full:
            logger.warning("Alert delivery queue full — dropping %s -> %s", alert.id, rule.channel)
            return False

    def _consume(self) -> None:
        while not self._stop.is_set():
            try:
                alert, rule = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                if _dispatch_channel(alert, rule):
                    alert_store.mark_delivered(alert.id)
            except Exception as exc:
                logger.warning("Alert delivery error for %s: %s", alert.id, exc)
            finally:
                self._queue.task_done()


alert_delivery_worker = AlertDeliveryWorker()


# ─────────────────────────────────────────────────────────────────────────────
# Environment-configured integrations (global channels)
# ─────────────────────────────────────────────────────────────────────────────


def env_integration_rules() -> list[AlertRule]:
    """Build implicit AlertRules from environment-configured SIEM channels."""
    rules: list[AlertRule] = []
    if settings.SLACK_WEBHOOK_URL:
        rules.append(
            AlertRule(
                id="env-slack",
                channel="SLACK",
                target_url=settings.SLACK_WEBHOOK_URL,
                risk_threshold=settings.ARTSA_ALERT_RISK_THRESHOLD,
                config={"source": "environment"},
            )
        )
    if settings.PAGERDUTY_ROUTING_KEY:
        rules.append(
            AlertRule(
                id="env-pagerduty",
                channel="PAGERDUTY",
                target_url=settings.PAGERDUTY_SERVICE_URL or "https://events.pagerduty.com/v2/enqueue",
                risk_threshold=settings.ARTSA_ALERT_RISK_THRESHOLD,
                config={"source": "environment"},
            )
        )
    if settings.SPLUNK_HEC_URL and settings.SPLUNK_HEC_TOKEN:
        rules.append(
            AlertRule(
                id="env-splunk",
                channel="SPLUNK",
                target_url=settings.SPLUNK_HEC_URL,
                risk_threshold=settings.ARTSA_ALERT_RISK_THRESHOLD,
                config={"source": "environment"},
            )
        )
    if settings.DATADOG_API_KEY:
        rules.append(
            AlertRule(
                id="env-datadog",
                channel="DATADOG",
                target_url="",
                risk_threshold=settings.ARTSA_ALERT_RISK_THRESHOLD,
                config={"source": "environment"},
            )
        )
    if settings.SENTINEL_WORKSPACE_ID and settings.SENTINEL_WORKSPACE_KEY:
        rules.append(
            AlertRule(
                id="env-sentinel",
                channel="SENTINEL",
                target_url="",
                risk_threshold=settings.ARTSA_ALERT_RISK_THRESHOLD,
                config={"source": "environment"},
            )
        )
    return rules


def dispatch_alert(alert: Alert) -> bool:
    """Dispatch an alert to every matching enabled integration.

    Targets = environment-configured channels + persisted store rules. Delivery
    is enqueued to a background worker so slow or stuck channels never block the
    ingest hot path. Returns True if at least one channel accepted the alert.
    """
    risk = alert.risk_score

    # Fire custom outbound connectors (config-driven, non-blocking) even when no
    # built-in channel is configured. Lazy import avoids a module cycle.
    try:
        from src.services.custom_integration_dispatcher import enqueue_alert

        enqueue_alert(alert)
    except Exception as exc:
        logger.warning("Custom integration enqueue failed for %s: %s", alert.id, exc)

    # Optional MongoDB sink: persist the alert to the artsa database (no-op when
    # ARTSA_MONGODB_URI is unset). Non-blocking.
    try:
        from src.services.mongo_sink import mongo_sink

        mongo_sink.enqueue_alert(alert)
    except Exception as exc:
        logger.warning("MongoDB alert enqueue failed for %s: %s", alert.id, exc)

    targets: list[AlertRule] = []

    for rule in env_integration_rules() + alert_store.get_webhook_rules():
        if not rule.enabled:
            continue
        if rule.channel not in SUPPORTED_CHANNELS:
            continue
        if risk < rule.risk_threshold:
            continue
        targets.append(rule)

    if not targets:
        return False

    # Enqueue every matching (alert, rule) for background delivery. Returns True
    # if at least one target was accepted by the worker (never blocks).
    accepted_any = False
    for rule in targets:
        if alert_delivery_worker.enqueue(alert, rule):
            accepted_any = True
    return accepted_any


def dispatch_test_alert(rule: AlertRule) -> dict[str, Any]:
    """Send a synthetic test alert through a specific rule (integration tests)."""
    test_alert = Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="integration-test",
        severity="HIGH",
        title="ARTSA test alert",
        message="Agent integration-test · risk 85.0 · recommended KILL",
        risk_score=85.0,
        channel=rule.channel,
        delivered=False,
    )
    delivered = _dispatch_channel(test_alert, rule)
    return {"status": "sent" if delivered else "failed", "alert": _base_fields(test_alert)}
