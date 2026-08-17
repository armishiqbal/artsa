"""Tests wiring custom connectors into the alert + telemetry hot paths.

Covers: dispatch_alert enqueues an alert event for custom connectors, the
registry matching honors event_type + risk_threshold, and drain_telemetry
forwards only the three telemetry event types to the worker.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

import pytest

from src.core.models.alerts import Alert
from src.services.custom_integration_registry import (
    CustomIntegration,
    CustomIntegrationRegistry,
)


def _alert(risk_message: str = "Agent agent-hook · risk 85.0 · recommended KILL") -> Alert:
    return Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="agent-hook",
        severity="HIGH",
        title="BREACHED on exec_command",
        message=risk_message,
        risk_score=85.0,
        channel="WEBHOOK",
        delivered=False,
        triggered_at=datetime(2025, 1, 15, 10, 30, 0, tzinfo=UTC),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Alert hook (dispatch_alert -> enqueue_alert)
# ─────────────────────────────────────────────────────────────────────────────


def test_dispatch_alert_enqueues_alert_event(monkeypatch):
    captured: list[tuple[str, dict]] = []

    class _FakeWorker:
        def enqueue(self, event_type: str, event: dict) -> bool:
            captured.append((event_type, event))
            return True

    monkeypatch.setattr(
        "src.services.custom_integration_dispatcher.custom_integration_worker", _FakeWorker()
    )

    # No built-in channels configured -> dispatch_alert returns False but the
    # custom connector hook must still fire (that's the point of the hook).
    monkeypatch.setattr("src.services.alert_dispatcher.env_integration_rules", lambda: [])
    from src.services.alert_store import seed_webhook_rules
    from src.services.alert_dispatcher import dispatch_alert

    seed_webhook_rules([])
    try:
        assert dispatch_alert(_alert()) is False
    finally:
        seed_webhook_rules([])

    assert len(captured) == 1
    event_type, event = captured[0]
    assert event_type == "alert"
    assert event["risk_score"] == 85.0
    assert event["agent_id"] == "agent-hook"
    assert event["type"] == "alert"
    assert "id" in event and "triggered_at" in event


def test_dispatch_alert_enqueue_failure_is_swallowed(monkeypatch):
    """A throwing enqueue must never break the built-in dispatch path."""

    class _BoomWorker:
        def enqueue(self, event_type: str, event: dict) -> bool:
            raise RuntimeError("worker died")

    monkeypatch.setattr(
        "src.services.custom_integration_dispatcher.custom_integration_worker", _BoomWorker()
    )
    monkeypatch.setattr("src.services.alert_dispatcher.env_integration_rules", lambda: [])
    from src.services.alert_store import seed_webhook_rules
    from src.services.alert_dispatcher import dispatch_alert

    seed_webhook_rules([])
    try:
        # Should return False (no built-in targets) without raising.
        assert dispatch_alert(_alert()) is False
    finally:
        seed_webhook_rules([])


def test_worker_process_dispatches_to_matching_connectors(monkeypatch):
    """The worker pool sends an event to every matching connector."""
    from src.services.custom_integration_dispatcher import CustomIntegrationWorker

    sent: list[str] = []

    def _fake_dispatch(integration, event_type, event):
        sent.append(integration.name)
        return True

    registry = CustomIntegrationRegistry()
    registry.load(
        [
            {
                "name": "below-threshold",
                "target_url": "https://a.test",
                "enabled": True,
                "event_types": ["alert"],
                "risk_threshold": 90.0,
                "headers": {},
                "secrets": {},
            },
            {
                "name": "matches",
                "target_url": "https://b.test",
                "enabled": True,
                "event_types": ["alert", "tool_call"],
                "risk_threshold": 0.0,
                "headers": {},
                "secrets": {},
            },
            {
                "name": "disabled",
                "target_url": "https://c.test",
                "enabled": False,
                "event_types": ["alert"],
                "risk_threshold": 0.0,
                "headers": {},
                "secrets": {},
            },
        ]
    )

    worker = CustomIntegrationWorker()
    # _process() imports the singleton from the registry module by name, so
    # patch it there (not on the dispatcher module).
    monkeypatch.setattr(
        "src.services.custom_integration_registry.custom_integration_registry", registry
    )
    monkeypatch.setattr(
        "src.services.custom_integration_dispatcher.dispatch", _fake_dispatch
    )
    worker._process("alert", {"risk_score": 85.0})
    assert sent == ["matches"]


# ─────────────────────────────────────────────────────────────────────────────
# Registry matching
# ─────────────────────────────────────────────────────────────────────────────


def test_registry_matching_respects_threshold_and_event_type():
    registry = CustomIntegrationRegistry()
    registry.load(
        [
            {
                "name": "high-only",
                "target_url": "https://a.test",
                "enabled": True,
                "event_types": ["alert"],
                "risk_threshold": 90.0,
                "headers": {},
                "secrets": {},
            },
            {
                "name": "all-alerts",
                "target_url": "https://b.test",
                "enabled": True,
                "event_types": ["alert", "tool_call"],
                "risk_threshold": 50.0,
                "headers": {},
                "secrets": {},
            },
        ]
    )
    matched = registry.matching("alert", 85.0)
    assert [m.name for m in matched] == ["all-alerts"]  # high-only needs >= 90
    assert [m.name for m in registry.matching("tool_call", 85.0)] == ["all-alerts"]
    assert registry.matching("session_action", 85.0) == []  # no subscriber
    assert registry.get("ALL-ALERTS").name == "all-alerts"  # slug-insensitive get


def test_registry_skips_disabled_and_missing_url():
    registry = CustomIntegrationRegistry()
    registry.load(
        [
            {
                "name": "disabled",
                "target_url": "https://a.test",
                "enabled": False,
                "event_types": ["alert"],
                "headers": {},
                "secrets": {},
            },
            {
                "name": "no-url",
                "target_url": "",
                "enabled": True,
                "event_types": ["alert"],
                "headers": {},
                "secrets": {},
            },
        ]
    )
    assert registry.names() == []


# ─────────────────────────────────────────────────────────────────────────────
# Telemetry drain
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_drain_telemetry_forwards_matching_types(monkeypatch):
    forwarded: list[str] = []

    class _FakeWorker:
        def enqueue(self, event_type: str, event: dict) -> bool:
            forwarded.append(event_type)
            return True

    monkeypatch.setattr(
        "src.services.custom_integration_dispatcher.custom_integration_worker", _FakeWorker()
    )

    from src.services.custom_integration_dispatcher import drain_telemetry
    from src.services.telemetry_bus import telemetry_bus

    task = asyncio.create_task(drain_telemetry())
    try:
        await asyncio.sleep(0.05)  # let the subscription register
        telemetry_bus.publish({"type": "tool_call", "session_id": "s1"})
        telemetry_bus.publish({"type": "proxy_call", "session_id": "s2"})
        telemetry_bus.publish({"type": "session_action", "session_id": "s3"})
        telemetry_bus.publish({"type": "some_other", "session_id": "s4"})
        await asyncio.sleep(0.05)
    finally:
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    # Only the three event-level types are forwarded; alerts use enqueue_alert.
    assert forwarded == ["tool_call", "proxy_call", "session_action"]


@pytest.mark.asyncio
async def test_drain_telemetry_unsubscribes_on_cancel(monkeypatch):
    from src.services.custom_integration_dispatcher import drain_telemetry
    from src.services.telemetry_bus import telemetry_bus

    before = len(telemetry_bus._subscribers)

    class _FakeWorker:
        def enqueue(self, event_type: str, event: dict) -> bool:
            return True

    monkeypatch.setattr(
        "src.services.custom_integration_dispatcher.custom_integration_worker", _FakeWorker()
    )

    task = asyncio.create_task(drain_telemetry())
    await asyncio.sleep(0.05)
    assert len(telemetry_bus._subscribers) == before + 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.sleep(0.01)
    assert len(telemetry_bus._subscribers) == before


def test_registry_returns_decrypted_connector():
    """Connectors loaded from the registry expose decrypted secrets in memory."""
    from src.core.config import settings
    from src.utils.crypto import encrypt_secret

    ciphertext = encrypt_secret("plaintext-token", settings.SECRET_KEY)
    registry = CustomIntegrationRegistry()
    registry.load(
        [
            {
                "name": "secrets",
                "target_url": "https://a.test",
                "enabled": True,
                "event_types": ["alert"],
                "headers": {},
                "secrets": {"token": ciphertext},
            }
        ]
    )
    conn = registry.get("secrets")
    assert conn is not None
    assert conn.secrets["token"] == "plaintext-token"
