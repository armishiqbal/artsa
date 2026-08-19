"""Tests for the custom-integration dispatch engine.

Covers auth header resolution for every auth type, request building (template
vs default payload), event-type/risk-threshold filtering, retry behavior, and
full dispatch against a mocked HTTP client.
"""

from __future__ import annotations

import base64
import json
from typing import Self

import pytest
from src.services.custom_integration_dispatcher import (
    build_request,
    dispatch,
    resolve_headers,
    send_request,
)
from src.services.custom_integration_registry import CustomIntegration


def _integration(**overrides) -> CustomIntegration:
    defaults = {
        "name": "sink",
        "target_url": "https://example.com/hook",
        "method": "POST",
        "auth_type": "none",
        "headers": {},
        "payload_template": None,
        "event_types": ["alert"],
        "risk_threshold": 0.0,
        "enabled": True,
        "retries": 3,
        "timeout": 10.0,
        "secrets": {},
    }
    defaults.update(overrides)
    return CustomIntegration(**defaults)


# ─────────────────────────────────────────────────────────────────────────────
# resolve_headers
# ─────────────────────────────────────────────────────────────────────────────


def test_headers_none_auth():
    headers = resolve_headers(_integration())
    assert headers["Content-Type"] == "application/json"
    assert headers["Accept"] == "application/json"
    assert "Authorization" not in headers


def test_headers_bearer():
    headers = resolve_headers(_integration(auth_type="bearer", secrets={"token": "tok-123"}))
    assert headers["Authorization"] == "Bearer tok-123"


def test_headers_api_key():
    headers = resolve_headers(_integration(auth_type="api_key", secrets={"api_key": "key-abc"}))
    assert headers["X-API-Key"] == "key-abc"


def test_headers_basic():
    headers = resolve_headers(
        _integration(auth_type="basic", secrets={"username": "u1", "password": "p@ss"})
    )
    expected = "Basic " + base64.b64encode(b"u1:p@ss").decode("ascii")
    assert headers["Authorization"] == expected


def test_headers_custom_secret_placeholder():
    integration = _integration(
        headers={"X-Signature": "hmac-{{secret:signature}}"}, secrets={"signature": "<sig>"}
    )
    headers = resolve_headers(integration)
    assert headers["X-Signature"] == "hmac-<sig>"


def test_headers_custom_unresolved_placeholder_left_alone():
    headers = resolve_headers(_integration(headers={"X-Tag": "{{missing.field}}"}))
    assert headers["X-Tag"] == "{{missing.field}}"


def test_headers_custom_override_base():
    integration = _integration(
        headers={"Content-Type": "application/x-ndjson", "X-Custom": "v1"}
    )
    headers = resolve_headers(integration)
    assert headers["Content-Type"] == "application/x-ndjson"
    assert headers["X-Custom"] == "v1"


# ─────────────────────────────────────────────────────────────────────────────
# build_request
# ─────────────────────────────────────────────────────────────────────────────


def test_build_request_default_payload():
    event = {"type": "alert", "agent_id": "a-1", "risk_score": 80.0}
    method, url, _, body = build_request(_integration(method="PUT"), "alert", event)
    assert method == "PUT"
    assert url == "https://example.com/hook"
    assert json.loads(body) == event


def test_build_request_renders_template():
    integration = _integration(
        payload_template='{"agent": "{{agent_id}}", "risk": "{{risk_score}}"}'
    )
    _method, _url, _headers, body = build_request(
        integration, "alert", {"agent_id": "a-9", "risk_score": 95.0}
    )
    rendered = json.loads(body)
    assert rendered["agent"] == "a-9"
    assert rendered["risk"] == 95.0  # typed


# ─────────────────────────────────────────────────────────────────────────────
# dispatch filtering
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

    def request(self, method, url, content=None, headers=None, **kwargs) -> _FakeResponse:
        self._captured["method"] = method
        self._captured["url"] = url
        self._captured["headers"] = headers
        self._captured["body"] = json.loads(content)
        return _FakeResponse()


class _FailingClient(_FakeClient):
    def request(self, *args, **kwargs) -> _FakeResponse:
        raise RuntimeError("connection refused")


@pytest.fixture
def captured():
    return {}


def test_dispatch_sends_with_auth_and_body(monkeypatch, captured):
    from src.services import custom_integration_dispatcher

    monkeypatch.setattr(custom_integration_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    integration = _integration(
        auth_type="bearer",
        secrets={"token": "tok-1"},
        headers={"X-Env": "prod"},
        payload_template='{"agent": "{{agent_id}}", "risk": "{{risk_score}}"}',
    )
    assert dispatch(integration, "alert", {"agent_id": "a-1", "risk_score": 90.0}) is True

    assert captured["method"] == "POST"
    assert captured["url"] == "https://example.com/hook"
    assert captured["headers"]["Authorization"] == "Bearer tok-1"
    assert captured["headers"]["X-Env"] == "prod"
    assert captured["body"] == {"agent": "a-1", "risk": 90.0}


def test_dispatch_skips_unsubscribed_event_type(monkeypatch, captured):
    from src.services import custom_integration_dispatcher

    monkeypatch.setattr(custom_integration_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    integration = _integration(event_types=["tool_call"])
    assert dispatch(integration, "alert", {"risk_score": 95.0}) is False
    assert "url" not in captured


def test_dispatch_skips_below_threshold(monkeypatch, captured):
    from src.services import custom_integration_dispatcher

    monkeypatch.setattr(custom_integration_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    integration = _integration(risk_threshold=90.0)
    assert dispatch(integration, "alert", {"risk_score": 85.0}) is False
    assert "url" not in captured


def test_dispatch_never_raises_on_upstream_failure(monkeypatch, captured):
    from src.services import custom_integration_dispatcher

    monkeypatch.setattr(custom_integration_dispatcher.httpx, "Client", lambda timeout: _FailingClient(captured))
    integration = _integration(retries=2)
    assert dispatch(integration, "alert", {"risk_score": 95.0}) is False


def test_send_request_zero_retries_still_attempts_once(monkeypatch, captured):
    from src.services import custom_integration_dispatcher

    monkeypatch.setattr(custom_integration_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured))
    assert send_request("POST", "https://example.com/hook", {}, b"{}", retries=0) is True
    assert captured["url"] == "https://example.com/hook"


def test_retries_on_failure(monkeypatch, captured):
    from src.services import custom_integration_dispatcher

    calls = {"n": 0}

    class _FlakyClient:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return None

        def request(self, method, url, content=None, headers=None, **kwargs) -> _FakeResponse:
            calls["n"] += 1
            if calls["n"] < 2:
                raise RuntimeError("timeout")
            return _FakeResponse()

    monkeypatch.setattr(custom_integration_dispatcher.httpx, "Client", lambda timeout: _FlakyClient())
    assert send_request("POST", "https://example.com/hook", {}, b"{}", retries=3) is True
    assert calls["n"] == 2  # first attempt fails, second succeeds
