"""Unified credential resolution for API key and OIDC bearer tokens."""

from __future__ import annotations

from typing import Optional

from src.core.config import settings
from src.core.rbac import Role, resolve_role


def extract_bearer_token(authorization_header: Optional[str]) -> Optional[str]:
    if not authorization_header:
        return None
    prefix = "bearer "
    if authorization_header.lower().startswith(prefix):
        token = authorization_header[len(prefix) :].strip()
        return token or None
    return None


def any_static_api_key_configured() -> bool:
    return any(
        settings.is_key_configured(k)
        for k in (
            "ARTSA_API_KEY",
            "ARTSA_ANALYST_API_KEY",
            "ARTSA_REDTEAM_API_KEY",
            "ARTSA_READONLY_API_KEY",
        )
    )


def resolve_credentials(
    api_key: Optional[str],
    bearer_token: Optional[str] = None,
) -> Optional[Role]:
    """Resolve role from X-API-Key and/or Authorization Bearer JWT."""
    if api_key:
        role = resolve_role(api_key)
        if role is not None:
            return role

    if bearer_token and settings.ARTSA_OIDC_ENABLED:
        from src.core.oidc import resolve_role_from_oidc

        return resolve_role_from_oidc(bearer_token)

    if not settings.auth_required and not any_static_api_key_configured() and not settings.ARTSA_OIDC_ENABLED:
        return Role.ADMIN

    return None
