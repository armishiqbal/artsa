"""Optional OIDC/JWT authentication — maps identity provider claims to ARTSA roles."""

from __future__ import annotations

import logging
from typing import Any

from src.core.config import settings
from src.core.rbac import Role

logger = logging.getLogger(__name__)

_jwks_client = None
_jwks_url_cache: str | None = None


def _split_groups(raw: str | None) -> frozenset[str]:
    if not raw:
        return frozenset()
    return frozenset(g.strip() for g in raw.split(",") if g.strip())


def role_from_claims(claims: dict[str, Any]) -> Role | None:
    """Map OIDC claims to ARTSA role using configured group lists."""
    claim_name = settings.ARTSA_OIDC_ROLE_CLAIM
    groups_raw = claims.get(claim_name)
    if groups_raw is None:
        groups_raw = claims.get("roles") or claims.get("groups")

    if isinstance(groups_raw, str):
        groups = {groups_raw}
    elif isinstance(groups_raw, list):
        groups = {str(g) for g in groups_raw}
    else:
        groups = set()

    admin_groups = _split_groups(settings.ARTSA_OIDC_ADMIN_GROUPS)
    analyst_groups = _split_groups(settings.ARTSA_OIDC_ANALYST_GROUPS)
    redteam_groups = _split_groups(settings.ARTSA_OIDC_REDTEAM_GROUPS)
    readonly_groups = _split_groups(settings.ARTSA_OIDC_READONLY_GROUPS)

    if groups & admin_groups:
        return Role.ADMIN
    if groups & analyst_groups:
        return Role.ANALYST
    if groups & redteam_groups:
        return Role.REDTEAM
    if groups & readonly_groups:
        return Role.READONLY

    if settings.ARTSA_OIDC_DEFAULT_ROLE:
        try:
            return Role(settings.ARTSA_OIDC_DEFAULT_ROLE)
        except ValueError:
            logger.warning("Invalid ARTSA_OIDC_DEFAULT_ROLE: %s", settings.ARTSA_OIDC_DEFAULT_ROLE)

    return None


def _resolve_jwks_url() -> str:
    global _jwks_url_cache
    if settings.ARTSA_OIDC_JWKS_URL:
        return settings.ARTSA_OIDC_JWKS_URL

    if _jwks_url_cache:
        return _jwks_url_cache

    import httpx

    issuer = settings.ARTSA_OIDC_ISSUER.rstrip("/")
    discovery_url = f"{issuer}/.well-known/openid-configuration"
    with httpx.Client(timeout=10.0) as client:
        response = client.get(discovery_url)
        response.raise_for_status()
        jwks_uri = response.json()["jwks_uri"]

    _jwks_url_cache = jwks_uri
    return jwks_uri


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        import jwt

        _jwks_client = jwt.PyJWKClient(_resolve_jwks_url())
    return _jwks_client


def verify_oidc_token(token: str) -> dict[str, Any] | None:
    """Validate JWT signature/audience/issuer; return claims or None."""
    if not settings.ARTSA_OIDC_ENABLED:
        return None
    if not settings.ARTSA_OIDC_ISSUER or not settings.ARTSA_OIDC_AUDIENCE:
        logger.error("OIDC enabled but ARTSA_OIDC_ISSUER or ARTSA_OIDC_AUDIENCE missing")
        return None

    try:
        import jwt

        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.ARTSA_OIDC_AUDIENCE,
            issuer=settings.ARTSA_OIDC_ISSUER,
            leeway=30,
        )
        return claims
    except Exception as exc:
        logger.debug("OIDC token verification failed: %s", exc)
        return None


def resolve_role_from_oidc(token: str) -> Role | None:
    claims = verify_oidc_token(token)
    if not claims:
        return None
    return role_from_claims(claims)
