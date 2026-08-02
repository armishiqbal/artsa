"""WebSocket credential validation (query params — browsers cannot set WS headers)."""

from __future__ import annotations

from typing import Optional

from fastapi import WebSocket

from src.core.auth_credentials import any_static_api_key_configured, resolve_credentials
from src.core.config import settings
from src.core.rbac import Role


def ws_auth_enforced() -> bool:
    return (
        settings.auth_required
        or any_static_api_key_configured()
        or settings.ARTSA_OIDC_ENABLED
    )


def resolve_ws_role(websocket: WebSocket) -> Optional[Role]:
    """Resolve role from query params or upgrade headers."""
    api_key = websocket.query_params.get("api_key") or websocket.headers.get("x-api-key")
    token = websocket.query_params.get("access_token")
    return resolve_credentials(api_key, token)


async def require_ws_auth(websocket: WebSocket) -> Optional[Role]:
    """Return role when authorized; close connection and return None when rejected."""
    role = resolve_ws_role(websocket)
    if ws_auth_enforced() and role is None:
        await websocket.close(code=1008, reason="Unauthorized")
        return None
    return role or Role.ADMIN
