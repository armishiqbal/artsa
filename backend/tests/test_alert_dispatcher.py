"""Unit tests for the multi-channel SIEM/SOAR alert dispatcher."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Self

import pytest
from fastapi.testclient import TestClient
from src.core.config import settings
from src.core.models.alerts import Alert, AlertRule
from src.services import alert_store
from src.services.alert_dispatcher import (
    build_datadog_payload,
    build_pagerduty_payload,
    build_sentinel_payload,
    build_slack_payload,
    build_splunk_payload,
    dispatch_alert,
    dispatch_test_alert,
    env_integration_rules,
    sentinel_signature,
)

from tests.conftest import unwrap_response


def _alert(severity: str = "HIGH") -> Alert:
    return Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="agent-dispatch-01",
        severity=severity,
        title="BREACHED on read_file",
        message="Agent agent-dispatch-01 · risk 85.0 · recommended KILL",
        risk_score=85.0,
        channel="WEBHOOK",
        delivered=False,
        triggered_at=datetime(2025, 1, 15, 10, 30, 0, tzinfo=UTC),
    )


def _rule(
    channel: str = "WEBHOOK",
    url: str = "https://example.com/hook",
    risk_threshold: float = 60.0,
    config: dict | None = None,
) -> AlertRule:
    return AlertRule(
        id=str(uuid.uuid4()),
        tenant_id="default_tenant",
        risk_threshold=risk_threshold,
        channel=channel,
        target_url=url,
        enabled=True,
        config=config or {},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Payload builders
# ─────────────────────────────────────────────────────────────────────────────


def test_structured_risk_score_used_not_message():
    """Payload builders read Alert.risk_score, never re-parse the message string."""
    alert = _alert()
    alert.message = "Agent x · (no risk number embedded)"
    alert.risk_score = 92.5
    slack_fields = build_slack_payload(alert, _rule(channel="SLACK"))["attachments"][0]["blocks"][1]["fields"]
    assert any("*Risk:* 92.5/100" in f["text"] for f in slack_fields)
    assert build_sentinel_payload(alert, _rule(channel="SENTINEL"))["RiskScore"] == 92.5
    assert build_splunk_payload(alert, _rule(channel="SPLUNK"))["event"]["risk_score"] == 92.5
    assert build_pagerduty_payload(alert, _rule(channel="PAGERDUTY"))["payload"]["custom_details"]["risk_score"] == 92.5
    assert "risk:92.5" in build_datadog_payload(alert, _rule(channel="DATADOG"))[0]["ddtags"]


def test_slack_payload_shape():
    payload = build_slack_payload(_alert(), _rule(channel="SLACK", config={"channel": "#sec-ops"}))
    assert payload["channel"] == "#sec-ops"
    assert payload["username"] == "ARTSA Containment"
    header = payload["attachments"][0]["blocks"][0]
    assert header["type"] == "header"
    assert "BREACHED on read_file" in header["text"]["text"]
    fields = payload["attachments"][0]["blocks"][1]["fields"]
    assert any("85.0/100" in f["text"] for f in fields)


def test_pagerduty_payload_shape():
    alert = _alert()
    payload = build_pagerduty_payload(alert, _rule(channel="PAGERDUTY", config={"pagerduty_routing_key": "rk-test"}))
    assert payload["event_action"] == "trigger"
    assert payload["routing_key"] == "rk-test"
    assert payload["dedup_key"] == str(alert.id)
    assert payload["payload"]["severity"] == "critical"
    assert payload["payload"]["summary"] == "[ARTSA] BREACHED on read_file"
    assert payload["payload"]["custom_details"]["risk_score"] == 85.0


def test_splunk_payload_shape():
    payload = build_splunk_payload(_alert(), _rule(channel="SPLUNK", config={"index": "artsa_prod"}))
    assert payload["sourcetype"] == "artsa:security:alert"
    assert payload["index"] == "artsa_prod"
    assert payload["event"]["risk_score"] == 85.0
    assert payload["time"] == int(datetime(2025, 1, 15, 10, 30, 0, tzinfo=UTC).timestamp())


def test_datadog_payload_shape():
    payload = build_datadog_payload(_alert(), _rule(channel="DATADOG"))
    assert isinstance(payload, list) and len(payload) == 1
    entry = payload[0]
    assert entry["ddsource"] == "artsa"
    assert "severity:high" in entry["ddtags"]
    assert entry["message"].startswith("BREACHED on read_file")


def test_sentinel_payload_shape():
    payload = build_sentinel_payload(_alert(), _rule(channel="SENTINEL"))
    assert payload["Provider"] == "ARTSA"
    assert payload["Severity"] == 3  # HIGH
    assert payload["RiskScore"] == 85.0
    assert payload["Title"] == "BREACHED on read_file"


def test_sentinel_signature_matches_azure_documented_vector():
    # Official Log Analytics Data Collector API sample from Microsoft docs.
    signature = sentinel_signature(
        workspace_id="70d6e5a3-5b8a-4f9a-8c9d-6b9f8a7c6e5d",
        shared_key="aGVsbG8gd29ybGQ=",  # base64("hello world")
        date="Sun, 19 Sep 2015 12:00:00 GMT",
        content_length=10,
    )
    assert signature == (
        "SharedKey 70d6e5a3-5b8a-4f9a-8c9d-6b9f8a7c6e5d:"
        "3tfTnYxcbrPxsKlDHRlKR/dePwEFDsYDyQO0TDzLm0A="
    )


# ─────────────────────────────────────────────────────────────────────────────
# Environment-configured integrations
# ─────────────────────────────────────────────────────────────────────────────


def test_env_integration_rules(monkeypatch):
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/AAA")
    monkeypatch.setattr(settings, "PAGERDUTY_ROUTING_KEY", "rk-env")
    monkeypatch.setattr(settings, "SPLUNK_HEC_URL", "https://splunk.local:8088")
    monkeypatch.setattr(settings, "SPLUNK_HEC_TOKEN", "hec-token")
    monkeypatch.setattr(settings, "DATADOG_API_KEY", "dd-key")
    monkeypatch.setattr(settings, "SENTINEL_WORKSPACE_ID", "ws-id")
    monkeypatch.setattr(settings, "SENTINEL_WORKSPACE_KEY", "ws-key")

    rules = env_integration_rules()
    channels = {r.channel for r in rules}
    assert channels == {"SLACK", "PAGERDUTY", "SPLUNK", "DATADOG", "SENTINEL"}


def test_env_integration_rules_empty(monkeypatch):
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", None)
    monkeypatch.setattr(settings, "PAGERDUTY_ROUTING_KEY", None)
    assert env_integration_rules() == []


# ─────────────────────────────────────────────────────────────────────────────
# Dispatch (mocked HTTP)
# ─────────────────────────────────────────────────────────────────────────────


class _FakeResponse:
    def raise_for_status(self) -> None:
        pass


class _FakeClient:
    def __init__(self, captured: dict) -> None:
        self._captured = captured

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc) -> None:
        return None

    def post(self, url, content=None, headers=None, **kwargs) -> _FakeResponse:
        self._captured["url"] = url
        self._captured["body"] = json.loads(content)
        self._captured["headers"] = headers
        return _FakeResponse()


@pytest.fixture
def captured():
    return {}


class _SyncDeliveryWorker:
    """Fake worker that delivers synchronously so tests can assert captured state."""

    def enqueue(self, alert, rule) -> bool:
        from src.services.alert_dispatcher import _dispatch_channel

        return _dispatch_channel(alert, rule)


def _install_sync_worker(monkeypatch) -> None:
    """Route dispatch_alert through a synchronous worker for deterministic asserts."""
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher, "alert_delivery_worker", _SyncDeliveryWorker())


def test_dispatch_slack(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    _install_sync_worker(monkeypatch)
    alert_store.seed_webhook_rules([_rule(channel="SLACK", url="https://hooks.slack.com/ABC")])
    try:
        assert dispatch_alert(_alert()) is True
    finally:
        alert_store.seed_webhook_rules([])

    assert captured["url"] == "https://hooks.slack.com/ABC"
    assert captured["body"]["username"] == "ARTSA Containment"


def test_dispatch_pagerduty(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    _install_sync_worker(monkeypatch)
    alert_store.seed_webhook_rules(
        [_rule(channel="PAGERDUTY", url="", config={"pagerduty_routing_key": "rk-1"})]
    )
    try:
        assert dispatch_alert(_alert()) is True
    finally:
        alert_store.seed_webhook_rules([])

    assert captured["url"] == "https://events.pagerduty.com/v2/enqueue"
    assert captured["body"]["event_action"] == "trigger"
    assert captured["body"]["routing_key"] == "rk-1"


def test_dispatch_splunk_sets_auth_header(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    _install_sync_worker(monkeypatch)
    alert_store.seed_webhook_rules(
        [
            _rule(
                channel="SPLUNK",
                url="https://splunk.local:8088/services/collector/event",
                config={"splunk_hec_token": "tkn"},
            )
        ]
    )
    try:
        assert dispatch_alert(_alert()) is True
    finally:
        alert_store.seed_webhook_rules([])

    assert captured["headers"]["Authorization"] == "Splunk tkn"
    assert captured["body"]["sourcetype"] == "artsa:security:alert"


def test_dispatch_datadog(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    monkeypatch.setattr(settings, "DATADOG_API_KEY", "dd-env-key")
    _install_sync_worker(monkeypatch)
    alert_store.seed_webhook_rules([_rule(channel="DATADOG", url="")])
    try:
        assert dispatch_alert(_alert()) is True
    finally:
        alert_store.seed_webhook_rules([])

    assert captured["url"] == "https://http-intake.logs.datadoghq.com/api/v2/logs"
    assert captured["headers"]["DD-API-KEY"] == "dd-env-key"


def test_dispatch_sentinel(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    _install_sync_worker(monkeypatch)
    alert_store.seed_webhook_rules(
        [
            _rule(
                channel="SENTINEL",
                url="",
                config={
                    "sentinel_workspace_id": "ws-123",
                    "sentinel_workspace_key": "aGVsbG8gd29ybGQ=",
                },
            )
        ]
    )
    try:
        assert dispatch_alert(_alert()) is True
    finally:
        alert_store.seed_webhook_rules([])

    assert captured["url"].startswith("https://ws-123.ods.opinsights.azure.com/api/logs")
    assert captured["headers"]["Log-Type"] == "ARTSA_Security"
    assert captured["headers"]["Authorization"].startswith("SharedKey ws-123:")


def test_dispatch_respects_risk_threshold(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    _install_sync_worker(monkeypatch)
    alert_store.seed_webhook_rules(
        [_rule(channel="SLACK", url="https://hooks.slack.com/XYZ", risk_threshold=95.0)]
    )
    try:
        # alert risk 85.0 < 95.0 -> no dispatch
        assert dispatch_alert(_alert()) is False
    finally:
        alert_store.seed_webhook_rules([])

    assert "url" not in captured


def test_dispatch_test_alert(monkeypatch, captured):
    from src.services import alert_dispatcher

    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    result = dispatch_test_alert(_rule(channel="WEBHOOK", url="https://example.com/hook"))
    assert result["status"] == "sent"
    assert result["alert"]["agent_id"] == "integration-test"


# ─────────────────────────────────────────────────────────────────────────────
# API routes
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def alerts_client():
    from src.api.main import create_app

    return TestClient(create_app())


def test_list_channels_endpoint(alerts_client):
    res = alerts_client.get("/api/v1/alerts/channels")
    assert res.status_code == 200
    body = unwrap_response(res)
    codes = {c["code"] for c in body["channels"]}
    assert {"SLACK", "PAGERDUTY", "SPLUNK", "DATADOG", "SENTINEL", "WEBHOOK"} <= codes


def test_create_integration_flow(alerts_client):
    res = alerts_client.post(
        "/api/v1/alerts/integrations",
        json={
            "channel": "SLACK",
            "target_url": "https://hooks.slack.com/TESTSLACK",
            "risk_threshold": 80.0,
            "config": {"channel": "#security"},
        },
    )
    assert res.status_code == 201
    rule_id = unwrap_response(res)["rule_id"]

    listed = unwrap_response(alerts_client.get("/api/v1/alerts/integrations"))
    assert any(i["id"] == rule_id and i["channel"] == "SLACK" for i in listed["integrations"])

    deleted = alerts_client.delete(f"/api/v1/alerts/integrations/{rule_id}")
    assert deleted.status_code == 200
    listed_after = unwrap_response(alerts_client.get("/api/v1/alerts/integrations"))
    assert not any(i["id"] == rule_id for i in listed_after["integrations"])


def test_create_integration_rejects_unknown_channel(alerts_client):
    res = alerts_client.post(
        "/api/v1/alerts/integrations",
        json={"channel": "FAX", "target_url": "https://example.com/fax"},
    )
    assert res.status_code == 400


def test_test_integration_endpoint(alerts_client, monkeypatch):
    from src.services import alert_dispatcher

    captured: dict = {}
    monkeypatch.setattr(alert_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))

    created = unwrap_response(alerts_client.post(
        "/api/v1/alerts/integrations",
        json={"channel": "WEBHOOK", "target_url": "https://example.com/route"},
    ))
    rule_id = created["rule_id"]

    res = alerts_client.post(f"/api/v1/alerts/integrations/{rule_id}/test")
    assert res.status_code == 200
    assert unwrap_response(res)["status"] == "sent"
    assert captured["url"] == "https://example.com/route"
