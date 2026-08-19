"""Tests for the optional MongoDB document sink.

Covers config gating (no-op without a URI), worker insert path, alert/telemetry
document shapes, failure tolerance, and the telemetry drainer — all with a fake
insert and no real Mongo connection.
"""

from __future__ import annotations

import asyncio
import time

import pytest
from pymongo import MongoClient  # noqa: F401  (ensures the dep is importable)
from src.core.models.alerts import Alert
from src.services.mongo_sink import MongoSink, mongo_enabled


def _fresh_sink() -> MongoSink:
    return MongoSink(maxsize=10)


def _wait_until(predicate, timeout: float = 2.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError("timed out waiting for worker")


@pytest.fixture(autouse=True)
def _mongo_settings(monkeypatch):
    """Default: mongo enabled with an innocuous URI. Tests override as needed."""
    monkeypatch.setattr(
        "src.services.mongo_sink.settings.ARTSA_MONGODB_URI",
        "mongodb://localhost:27017/test?authSource=admin",
    )
    monkeypatch.setattr("src.services.mongo_sink.settings.ARTSA_MONGODB_DB", "artsa")


# ─────────────────────────────────────────────────────────────────────────────
# Config gating
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "uri,expected",
    [
        ("mongodb+srv://cluster.example/db", True),
        ("mongodb://localhost:27017/test", True),
        (None, False),
        ("", False),
        ("disabled", False),
        ("Disabled", False),
    ],
)
def test_mongo_enabled_gating(monkeypatch, uri, expected):
    monkeypatch.setattr("src.services.mongo_sink.settings.ARTSA_MONGODB_URI", uri)
    assert mongo_enabled() is expected


def test_enqueue_noop_when_disabled(monkeypatch):
    monkeypatch.setattr("src.services.mongo_sink.settings.ARTSA_MONGODB_URI", None)
    sink = _fresh_sink()
    sink.start()
    assert sink.enqueue("alerts", {"type": "alert"}) is False
    sink.stop(wait=True)


def test_enqueue_noop_when_not_started(monkeypatch):
    sink = _fresh_sink()
    assert sink.enqueue("alerts", {"type": "alert"}) is False


# ─────────────────────────────────────────────────────────────────────────────
# Worker insert path
# ─────────────────────────────────────────────────────────────────────────────


def test_worker_inserts_document(monkeypatch):
    captured: list[tuple[str, dict]] = []
    sink = _fresh_sink()

    def fake_insert(collection: str, doc: dict) -> None:
        captured.append((collection, doc))

    monkeypatch.setattr(sink, "_insert", fake_insert)
    sink.start()
    try:
        doc = {"type": "tool_call", "session_id": "s1"}
        assert sink.enqueue("events", doc) is True
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    assert captured == [("events", {"type": "tool_call", "session_id": "s1"})]


def test_insert_failure_does_not_kill_worker(monkeypatch):
    captured: list[tuple[str, dict]] = []
    attempts = {"n": 0}
    sink = _fresh_sink()

    def flaky_insert(collection: str, doc: dict) -> None:
        attempts["n"] += 1
        if attempts["n"] == 1:  # first insert blows up, second succeeds
            raise OSError("network down")
        captured.append((collection, doc))

    monkeypatch.setattr(sink, "_insert", flaky_insert)
    sink.start()
    try:
        assert sink.enqueue("events", {"type": "tool_call", "n": 1}) is True
        assert sink.enqueue("events", {"type": "tool_call", "n": 2}) is True
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)
    assert captured == [("events", {"type": "tool_call", "n": 2})]


def test_enqueue_drops_on_full_queue(monkeypatch):
    """A full bounded queue drops with a warning instead of blocking."""
    sink = MongoSink(maxsize=1)
    monkeypatch.setattr(sink, "_insert", lambda collection, doc: None)
    sink._started = True  # bypass worker so the queue fills
    try:
        assert sink.enqueue("events", {"n": 1}) is True
        assert sink.enqueue("events", {"n": 2}) is False  # full -> drop
    finally:
        sink._started = False


# ─────────────────────────────────────────────────────────────────────────────
# Document shapes
# ─────────────────────────────────────────────────────────────────────────────


def test_enqueue_alert_builds_document(monkeypatch):
    captured: list[tuple[str, dict]] = []
    sink = _fresh_sink()
    monkeypatch.setattr(sink, "_insert", lambda collection, doc: captured.append((collection, doc)))
    sink.start()
    try:
        alert = Alert(
            session_id="1c5e1ac4-5d63-40c8-b0ad-c9c4eb94eb9f",
            agent_id="agent-x",
            severity="HIGH",
            title="BREACHED on exec_command",
            message="Agent agent-x · risk 85.0 · recommended KILL",
            risk_score=85.0,
            channel="WEBHOOK",
        )
        sink.enqueue_alert(alert)
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "alerts"
    assert doc["type"] == "alert"
    assert doc["alert_id"] == str(alert.id)
    assert doc["session_id"] == "1c5e1ac4-5d63-40c8-b0ad-c9c4eb94eb9f"
    assert doc["agent_id"] == "agent-x"
    assert doc["severity"] == "HIGH"
    assert doc["risk_score"] == 85.0  # read from the structured field
    assert doc["channel"] == "WEBHOOK"
    assert "ts" in doc and "triggered_at" in doc


def test_enqueue_telemetry_adds_timestamp(monkeypatch):
    captured: list[tuple[str, dict]] = []
    sink = _fresh_sink()
    monkeypatch.setattr(sink, "_insert", lambda collection, doc: captured.append((collection, doc)))
    sink.start()
    try:
        sink.enqueue_telemetry({"type": "tool_call", "tool_name": "exec_command"})
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "events"
    assert doc["tool_name"] == "exec_command"
    assert "ts" in doc


# ─────────────────────────────────────────────────────────────────────────────
# Telemetry drainer
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_drain_telemetry_forwards_matching_types(monkeypatch):
    forwarded: list[dict] = []
    monkeypatch.setattr(
        "src.services.mongo_sink.mongo_sink",
        type("Fake", (), {"enqueue_telemetry": lambda self, ev: forwarded.append(ev)})(),
    )

    from src.services.mongo_sink import drain_telemetry
    from src.services.telemetry_bus import telemetry_bus

    task = asyncio.create_task(drain_telemetry())
    try:
        await asyncio.sleep(0.05)
        telemetry_bus.publish({"type": "tool_call", "session_id": "s1"})
        telemetry_bus.publish({"type": "proxy_call", "session_id": "s2"})
        telemetry_bus.publish({"type": "session_action", "session_id": "s3"})
        telemetry_bus.publish({"type": "alert", "session_id": "s4"})  # never on the bus
        await asyncio.sleep(0.05)
    finally:
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    assert [e["type"] for e in forwarded] == ["tool_call", "proxy_call", "session_action"]


@pytest.mark.asyncio
async def test_drain_telemetry_unsubscribes_on_cancel(monkeypatch):
    from src.services.mongo_sink import drain_telemetry
    from src.services.telemetry_bus import telemetry_bus

    before = len(telemetry_bus._subscribers)

    monkeypatch.setattr(
        "src.services.mongo_sink.mongo_sink",
        type("Fake", (), {"enqueue_telemetry": lambda self, ev: None})(),
    )

    task = asyncio.create_task(drain_telemetry())
    await asyncio.sleep(0.05)
    assert len(telemetry_bus._subscribers) == before + 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.sleep(0.01)
    assert len(telemetry_bus._subscribers) == before
