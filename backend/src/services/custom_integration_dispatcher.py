"""Custom outbound integration dispatch engine.

Users define connectors to any HTTP system (method, URL, headers, auth,
payload template, event triggers) in the UI/API. This module delivers events to
them without blocking the ingest hot path:

* Alert events are enqueued from :func:`alert_dispatcher.dispatch_alert`.
* ``tool_call`` / ``proxy_call`` / ``session_action`` events are forwarded from
  the telemetry bus by :func:`drain_telemetry`.

Dispatch happens on a bounded thread-safe queue drained by a small worker pool;
``enqueue`` uses ``put_nowait`` so a full queue drops (with a warning) rather
than ever blocking the caller.

Templates are JSON text with ``{{field}}`` / ``{{a.b.0.c}}`` placeholders
resolved against the event payload, and ``{{secret:name}}`` placeholders
resolved from the connector's encrypted secret store. No code execution.
"""

from __future__ import annotations

import base64
import json
import logging
import queue
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_WHOLE_TOKEN_RE = re.compile(r"^\{\{([^{}]+)\}\}$")
_EMBEDDED_TOKEN_RE = re.compile(r"\{\{([^{}]+)\}\}")


# ─────────────────────────────────────────────────────────────────────────────
# Template rendering (pure functions — unit-testable)
# ─────────────────────────────────────────────────────────────────────────────


def lookup_path(context: dict[str, Any], path: str) -> Any:
    """Resolve a dotted path (``a.b.0.c``) into a context dict/list.

    Integer segments index lists. Returns ``None`` for any missing segment so
    templates can reference optional fields without raising.
    """
    current: Any = context
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return current


def render_string(value: str, context: dict[str, Any], secrets: dict[str, str]) -> str | Any:
    """Render a string against the event context + connector secrets.

    A whole-token ``{{field}}`` resolves to the *typed* value (numbers, booleans
    and nested structures are preserved); ``{{secret:name}}`` resolves from the
    secrets map. Embedded tokens in longer text are stringified. Unresolved
    tokens are left untouched so a missing optional field never breaks the
    payload or leaks a partial value.
    """
    whole = _WHOLE_TOKEN_RE.match(value)
    if whole:
        token = whole.group(1)
        if token.startswith("secret:"):
            name = token[len("secret:") :]
            return secrets.get(name, value)
        resolved = lookup_path(context, token)
        return value if resolved is None else resolved

    def _sub(match: re.Match[str]) -> str:
        token = match.group(1)
        if token.startswith("secret:"):
            name = token[len("secret:") :]
            return secrets.get(name, "")
        resolved = lookup_path(context, token)
        if resolved is None:
            return match.group(0)
        if isinstance(resolved, (dict, list)):
            return json.dumps(resolved)
        return str(resolved)

    return _EMBEDDED_TOKEN_RE.sub(_sub, value)


def render_value(value: Any, context: dict[str, Any], secrets: dict[str, str]) -> Any:
    """Recursively render a parsed JSON template node."""
    if isinstance(value, str):
        return render_string(value, context, secrets)
    if isinstance(value, dict):
        return {k: render_value(v, context, secrets) for k, v in value.items()}
    if isinstance(value, list):
        return [render_value(v, context, secrets) for v in value]
    return value


def render_json_template(
    template: str, context: dict[str, Any], secrets: dict[str, str] | None = None
) -> Any:
    """Render a JSON payload template against an event context.

    The template must be valid JSON. A whole-token ``{{field}}`` becomes a typed
    value (e.g. a number stays a number); everything else is stringified.
    """
    secrets = secrets or {}
    try:
        parsed = json.loads(template)
    except json.JSONDecodeError as exc:
        raise ValueError(f"payload_template is not valid JSON: {exc}") from exc
    return render_value(parsed, context, secrets)


def build_default_payload(event_type: str, event: dict[str, Any]) -> dict[str, Any]:
    """Default payload for an event: the event fields themselves.

    ``tool_call`` / ``proxy_call`` / ``session_action`` events already carry the
    telemetry-bus shapes documented by ``GET /integrations/schema``; alert
    events are constructed by :func:`enqueue_alert` with the same flat shape.
    """
    return dict(event)


# ─────────────────────────────────────────────────────────────────────────────
# Header / auth resolution
# ─────────────────────────────────────────────────────────────────────────────

# Auth type -> secret names used (documented in GET /integrations/schema).
AUTH_SECRET_NAMES: dict[str, tuple[str, ...]] = {
    "none": (),
    "bearer": ("token",),
    "api_key": ("api_key",),
    "basic": ("username", "password"),
}


def resolve_headers(integration: Any) -> dict[str, str]:
    """Resolve the final header set for a connector.

    Base JSON headers + auth header for the connector's auth type + any custom
    headers with ``{{secret:name}}`` placeholders resolved from the connector's
    secret store.
    """
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    secrets: dict[str, str] = getattr(integration, "secrets", {}) or {}

    auth_type = (getattr(integration, "auth_type", "none") or "none").lower()
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {secrets.get('token', '')}"
    elif auth_type == "api_key":
        headers["X-API-Key"] = secrets.get("api_key", "")
    elif auth_type == "basic":
        user = secrets.get("username", "")
        password = secrets.get("password", "")
        encoded = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {encoded}"

    for key, value in (getattr(integration, "headers", {}) or {}).items():
        rendered = render_string(str(value), {}, secrets)
        headers[str(key)] = rendered
    return headers


# ─────────────────────────────────────────────────────────────────────────────
# Dispatch
# ─────────────────────────────────────────────────────────────────────────────


def build_request(
    integration: Any, event_type: str, event: dict[str, Any]
) -> tuple[str, str, dict[str, str], bytes]:
    """Build (method, url, headers, body) for a connector + event."""
    payload_template = getattr(integration, "payload_template", None)
    if payload_template and str(payload_template).strip():
        rendered = render_json_template(str(payload_template), event, integration.secrets)
        body = json.dumps(rendered).encode("utf-8")
    else:
        body = json.dumps(build_default_payload(event_type, event)).encode("utf-8")
    return (
        (getattr(integration, "method", "POST") or "POST").upper(),
        integration.target_url,
        resolve_headers(integration),
        body,
    )


def send_request(
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes,
    retries: int = 3,
    timeout: float = 10.0,
) -> bool:
    """POST/PUT/PATCH a payload to a target with bounded retries.

    Returns True if any attempt succeeded. Never raises — failures are logged.
    """
    for attempt in range(1, max(int(retries), 1) + 1):
        try:
            with httpx.Client(timeout=float(timeout)) as client:
                response = client.request(method, url, content=body, headers=headers)
                response.raise_for_status()
            logger.info(
                "Custom integration delivered %s to %s (%s, attempt %s)",
                method,
                url,
                len(body),
                attempt,
            )
            return True
        except Exception as exc:
            logger.warning(
                "Custom integration %s %s attempt %s/%s failed: %s",
                method,
                url,
                attempt,
                retries,
                exc,
            )
    return False


def dispatch(integration: Any, event_type: str, event: dict[str, Any]) -> bool:
    """Dispatch one event through one connector, honoring its filters."""
    risk = float(event.get("risk_score") or 0.0)
    if event_type not in (getattr(integration, "event_types", None) or []):
        return False
    if risk < getattr(integration, "risk_threshold", 0.0):
        return False
    method, url, headers, body = build_request(integration, event_type, event)
    return send_request(
        method,
        url,
        headers,
        body,
        retries=getattr(integration, "retries", 3),
        timeout=getattr(integration, "timeout", 10.0),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Bounded worker pool (fire-and-forget hot path)
# ─────────────────────────────────────────────────────────────────────────────


class CustomIntegrationWorker:
    """Deliver queued events to matching connectors off the hot path."""

    def __init__(self, maxsize: int = 1000, workers: int = 2) -> None:
        self._queue: queue.Queue[tuple[str, dict[str, Any]]] = queue.Queue(maxsize=maxsize)
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="cix")
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
        except Exception:  # pragma: no cover - already shut down
            pass

    def enqueue(self, event_type: str, event: dict[str, Any]) -> bool:
        """Queue an event for dispatch. Returns False (drops) on a full queue."""
        if not self._started:
            return False
        try:
            self._queue.put_nowait((event_type, event))
            return True
        except queue.Full:
            logger.warning("Custom integration queue full — dropping %s event", event_type)
            return False

    def _consume(self) -> None:
        while not self._stop.is_set():
            try:
                item = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self._process(*item)
            except Exception as exc:
                logger.warning("Custom integration dispatch error: %s", exc)
            finally:
                self._queue.task_done()

    def _process(self, event_type: str, event: dict[str, Any]) -> None:
        from src.services.custom_integration_registry import custom_integration_registry

        risk = float(event.get("risk_score") or 0.0)
        for integration in custom_integration_registry.matching(event_type, risk):
            try:
                dispatch(integration, event_type, event)
            except Exception as exc:
                logger.warning("Custom integration %s dispatch failed: %s", integration.name, exc)


custom_integration_worker = CustomIntegrationWorker()


# ─────────────────────────────────────────────────────────────────────────────
# Entry points (hook into alert + telemetry flows)
# ─────────────────────────────────────────────────────────────────────────────


def enqueue_alert(alert: Any) -> None:
    """Build the alert event and queue it for custom connector dispatch.

    Called from :func:`alert_dispatcher.dispatch_alert` (lazy import to avoid a
    module cycle). Non-blocking.
    """
    risk = alert.risk_score
    event: dict[str, Any] = {
        "type": "alert",
        "id": str(alert.id),
        "session_id": str(alert.session_id),
        "agent_id": alert.agent_id,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "channel": alert.channel,
        "triggered_at": alert.triggered_at.isoformat(),
        "risk_score": risk,
    }
    custom_integration_worker.enqueue("alert", event)


def sample_event(event_type: str) -> dict[str, Any]:
    """Synthetic sample event per type for the Test action."""
    base: dict[str, Any] = {
        "type": event_type,
        "session_id": str(uuid.uuid4()),
        "agent_id": "integration-test",
        "risk_score": 85.0,
    }
    if event_type == "alert":
        base.update(
            {
                "id": str(uuid.uuid4()),
                "severity": "HIGH",
                "title": "BREACHED on exec_command",
                "message": "Agent integration-test · risk 85.0 · recommended KILL",
                "channel": "WEBHOOK",
                "triggered_at": datetime.now(UTC).isoformat(),
            }
        )
    elif event_type == "tool_call":
        base.update(
            {
                "tool_name": "exec_command",
                "verdict": "BREACHED",
                "confidence": 0.92,
                "action": "KILL",
                "severity": "HIGH",
                "flags": ["goal_drift", "tool_abuse"],
                "security_event_count": 2,
                "detectors": ["goal_drift", "tool_abuse"],
                "security_events": [
                    {"detector": "goal_drift", "risk_score": 88.0, "severity": "HIGH"}
                ],
                "enforced": True,
                "session_status": "QUARANTINED",
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    elif event_type == "proxy_call":
        base.update(
            {
                "agent_id": "artsa-proxy",
                "tool_name": "llm_chat",
                "provider": "openai",
                "model": "gpt-5.6-terra",
                "stream": False,
                "action": "BLOCK",
                "verdict": "SUSPICIOUS",
                "flags": ["prompt_injection"],
                "severity": "HIGH",
                "latency_ms": 12.3,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    elif event_type == "session_action":
        base.update(
            {
                "action": "QUARANTINE",
                "session_status": "QUARANTINED",
                "verdict": "BREACHED",
                "severity": "HIGH",
                "flags": ["goal_drift"],
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    return base


async def drain_telemetry() -> None:
    """Forward telemetry-bus events to matching custom connectors.

    Started in the app lifespan. Only the three event-level types are forwarded;
    alerts flow through :func:`enqueue_alert` instead (they are not on the bus).
    """
    from src.services.telemetry_bus import telemetry_bus

    queue_ = await telemetry_bus.subscribe()
    try:
        while True:
            event = await queue_.get()
            event_type = event.get("type")
            if event_type in ("tool_call", "proxy_call", "session_action"):
                custom_integration_worker.enqueue(event_type, event)
    finally:
        telemetry_bus.unsubscribe(queue_)
