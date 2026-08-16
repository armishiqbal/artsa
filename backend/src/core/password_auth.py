"""Signed session tokens for email/password logins.

A successful password login issues a short-lived JWT (HS256) signed with
``settings.SECRET_KEY``. The existing auth middleware already understands
``Authorization: Bearer``; this module makes that path accept ARTSA's own
tokens in addition to OIDC JWTs, so no new auth transport is needed.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from src.core.config import settings

_SESSION_ALG = "HS256"


def password_auth_enabled() -> bool:
    """Password auth is available when enabled and SECRET_KEY can sign tokens."""
    return bool(settings.ARTSA_PASSWORD_AUTH_ENABLED) and bool(settings.SECRET_KEY)


def create_session_token(
    user_id: str,
    email: str,
    role: str,
    ttl_sec: int | None = None,
    display_name: str | None = None,
    avatar: str | None = None,
) -> str:
    """Sign a short-lived session token for a local user account."""
    ttl = ttl_sec or settings.ARTSA_SESSION_TTL_SEC
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
    }
    if display_name:
        claims["display_name"] = display_name
    if avatar:
        claims["avatar"] = avatar
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=_SESSION_ALG)


def decode_session_token(token: str | None) -> dict[str, Any] | None:
    """Validate an ARTSA-issued session token; return claims or None."""
    if not token or not settings.SECRET_KEY:
        return None
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[_SESSION_ALG])
    except (jwt.InvalidTokenError, jwt.ExpiredSignatureError):
        return None
    return claims


def is_session_token(token: str | None) -> bool:
    """True when the bearer token is a valid ARTSA session token (not OIDC)."""
    return decode_session_token(token) is not None
