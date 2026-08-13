"""Short-lived, single-use WebSocket authentication tickets.

The frontend mints a ticket before opening a WebSocket instead of putting the
OIDC bearer token in the URL, so credentials never land in proxy/access logs.
Tickets are signed with HMAC-SHA256 using a server secret and are single-use
to bound replay.

Format: ``<urlsafe-b64(json-payload)>.<urlsafe-b64(hmac-sha256(payload))>``
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

from src.core.config import settings
from src.core.rbac import Role

# Consumed (single-use) tickets: {ticket: expiry_epoch_seconds}
_consumed: dict[str, float] = {}


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(payload_b64: str, secret: str) -> str:
    return _b64encode(
        hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    )


def _prune_consumed() -> None:
    now = time.time()
    expired = [t for t, exp in _consumed.items() if exp < now]
    for t in expired:
        _consumed.pop(t, None)


def create_ws_ticket(role: Role | str) -> str:
    """Mint a short-lived, single-use WebSocket auth ticket for the given role."""
    now = int(time.time())
    payload = {
        "role": role.value if isinstance(role, Role) else str(role),
        "iat": now,
        "nbf": now,
        "exp": now + settings.ARTSA_WS_TICKET_TTL_SEC,
        "nonce": secrets.token_urlsafe(16),
    }
    payload_b64 = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _sign(payload_b64, settings.ws_ticket_secret)
    return f"{payload_b64}.{sig}"


def verify_ws_ticket(ticket: str | None) -> Role | None:
    """Validate a ticket; returns the granted Role or None when invalid or replayed."""
    if not ticket or "." not in ticket:
        return None

    payload_b64, sig = ticket.split(".", 1)
    if not hmac.compare_digest(sig, _sign(payload_b64, settings.ws_ticket_secret)):
        return None

    try:
        payload = json.loads(_b64decode(payload_b64))
        if not isinstance(payload, dict):
            return None
        role = Role(payload.get("role", ""))
        exp = float(payload.get("exp", 0))
        nbf = float(payload.get("nbf", 0))
    except (ValueError, TypeError):
        return None

    now = time.time()
    if exp < now or nbf > now:
        return None

    # Single-use: reject replays of an already-consumed ticket.
    _prune_consumed()
    if ticket in _consumed:
        return None
    _consumed[ticket] = exp

    return role
