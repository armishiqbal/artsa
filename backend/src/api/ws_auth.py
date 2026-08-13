"""WebSocket credential validation (query params — browsers cannot set WS headers)."""

from __future__ import annotations

from fastapi import WebSocket

from src.core.auth_credentials import any_static_api_key_configured, resolve_credentials
from src.core.config import settings
from src.core.rbac import Role
from src.core.ws_tickets import verify_ws_ticket


def ws_auth_enforced() -> bool:
    return (
        settings.auth_required
        or any_static_api_key_configured()
        or settings.ARTSA_OIDC_ENABLED
    )


def resolve_ws_role(websocket: WebSocket) -> Role | None:
    """Resolve role from query params or upgrade headers.

    Credential precedence:
      1. ``ticket`` — short-lived, single-use HMAC ticket (frontend OIDC path).
      2. ``api_key`` query param / ``x-api-key`` header — static-key setups.
      3. ``access_token`` query param — legacy OIDC path (kept for backward compat).
    """
    ticket = websocket.query_params.get("ticket")
    if ticket:
        role = verify_ws_ticket(ticket)
        if role is not None:
            return role

    api_key = websocket.query_params.get("api_key") or websocket.headers.get("x-api-key")
    token = websocket.query_params.get("access_token")
    return resolve_credentials(api_key, token)


async def require_ws_auth(websocket: WebSocket) -> Role | None:
    """Return role when authorized; close connection and return None when rejected."""
    role = resolve_ws_role(websocket)
    if ws_auth_enforced() and role is None:
        await websocket.close(code=1008, reason="Unauthorized")
        return None
    return role or Role.ADMIN
