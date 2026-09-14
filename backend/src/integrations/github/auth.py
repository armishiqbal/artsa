"""GitHub App authentication and scoped installation access token generator.

Enforces least-privilege scoping:
- Generates RS256 JWTs using GitHub App ID and RSA private key (PEM).
- Requests scoped installation access tokens restricted to allowed repositories
  and narrow permissions (issues: write, contents: read, metadata: read).
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from src.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_NARROW_PERMISSIONS: dict[str, str] = {
    "issues": "write",
    "contents": "read",
    "metadata": "read",
}

FORBIDDEN_PERMISSIONS: frozenset[str] = frozenset({
    "administration",
    "organization_administration",
    "organization_custom_roles",
    "organization_roles",
    "organization_secrets",
    "secrets",
    "workflows",
    "members",
    "organization_plan",
    "organization_self_hosted_runners",
    "organization_user_blocking",
    "team_discussions",
})


def generate_rsa_key_pair(key_size: int = 2048) -> tuple[str, str]:
    """Generate an RSA private and public key pair in PEM format (for tests and dev)."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    return private_pem, public_pem


def generate_app_jwt(
    app_id: str | int | None = None,
    private_key: str | None = None,
    expire_seconds: int = 600,
) -> str:
    """Generate an RS256 JWT for GitHub App authentication.

    Payload:
    - iat: now - 60s (to prevent clock-drift rejections)
    - exp: now + expire_seconds (max 10 minutes / 600s per GitHub spec)
    - iss: GitHub App ID
    """
    effective_app_id = app_id or settings.GITHUB_APP_ID
    effective_key = private_key or settings.github_private_key_content
    if not effective_app_id:
        raise ValueError("GitHub App ID must be provided or configured in settings.GITHUB_APP_ID")
    if not effective_key:
        raise ValueError("GitHub App private key must be provided or configured in settings")

    effective_key = effective_key.replace("\\n", "\n").strip()

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + max(60, min(expire_seconds, 600)),
        "iss": str(effective_app_id),
    }
    return jwt.encode(payload, effective_key, algorithm="RS256")


async def generate_installation_token(
    installation_id: str | int | None = None,
    repositories: list[str] | None = None,
    permissions: dict[str, str] | None = None,
    app_id: str | int | None = None,
    private_key: str | None = None,
    http_client: httpx.AsyncClient | None = None,
    base_url: str = "https://api.github.com",
) -> dict[str, Any]:
    """Request a scoped installation access token from GitHub API.

    Enforces minimum privileges:
    - Scoped repositories list (defaults to settings.GITHUB_ALLOWED_REPOSITORIES).
      Unscoped requests are strictly prohibited to prevent full-organization token issuance.
    - Narrow permissions (issues: write, contents: read, metadata: read).
      Organization-admin, workflow, secrets, and permission-management access are prohibited.
    """
    effective_inst_id = installation_id or settings.GITHUB_INSTALLATION_ID
    if not effective_inst_id:
        raise ValueError("GitHub Installation ID must be provided or configured in settings")

    # Enforce forbidden permission restrictions
    if permissions is not None:
        for perm in permissions:
            if perm.lower() in FORBIDDEN_PERMISSIONS:
                raise ValueError(
                    f"Permission '{perm}' is forbidden: ARTSA policy strictly prohibits "
                    "organization-admin, workflow, secrets, and permission-management access."
                )
        effective_perms = permissions
    else:
        effective_perms = DEFAULT_NARROW_PERMISSIONS

    raw_repos = repositories if repositories is not None else settings.GITHUB_ALLOWED_REPOSITORIES
    # GitHub accepts repo names without owner (e.g. 'repo-name') or full names
    scoped_repos = [r.strip().split("/")[-1] for r in raw_repos if r and r.strip()] if raw_repos else []

    if not scoped_repos:
        raise ValueError(
            "Scoped repositories must be explicitly provided to enforce least privilege. "
            "An empty repositories list would grant access to all installation repositories."
        )

    app_jwt = generate_app_jwt(app_id=app_id, private_key=private_key)

    url = f"{base_url.rstrip('/')}/app/installations/{effective_inst_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body: dict[str, Any] = {
        "permissions": effective_perms,
        "repositories": scoped_repos,
    }

    if http_client is not None:
        resp = await http_client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


class GitHubAuthManager:
    """Authentication and token scoping manager for GitHub Apps."""

    def __init__(
        self,
        app_id: str | int | None = None,
        private_key: str | None = None,
        installation_id: str | int | None = None,
        allowed_repositories: list[str] | None = None,
        base_url: str = "https://api.github.com",
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.app_id = app_id
        self.private_key = private_key
        self.installation_id = installation_id
        self.allowed_repositories = allowed_repositories
        self.base_url = base_url
        self.http_client = http_client
        self._cached_token: dict[str, Any] | None = None

    def get_app_jwt(self, expire_seconds: int = 600) -> str:
        return generate_app_jwt(
            app_id=self.app_id,
            private_key=self.private_key,
            expire_seconds=expire_seconds,
        )

    async def get_scoped_installation_token(
        self,
        repositories: list[str] | None = None,
        permissions: dict[str, str] | None = None,
        force_refresh: bool = False,
    ) -> str:
        repos = repositories if repositories is not None else self.allowed_repositories
        now = time.time()
        if not force_refresh and self._cached_token:
            expires_at_str = self._cached_token.get("expires_at")
            cached_token_str = self._cached_token.get("token")
            if expires_at_str and cached_token_str:
                try:
                    from datetime import datetime
                    exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                    if exp_dt.timestamp() - now > 60:
                        cached_repos = self._cached_token.get("repositories")
                        req_repos = [r.strip().split("/")[-1] for r in repos if r and r.strip()] if repos else []
                        if cached_repos is None or set(req_repos).issubset(set(cached_repos)):
                            return str(cached_token_str)
                except Exception:
                    pass

        token_data = await generate_installation_token(
            installation_id=self.installation_id,
            repositories=repos,
            permissions=permissions,
            app_id=self.app_id,
            private_key=self.private_key,
            http_client=self.http_client,
            base_url=self.base_url,
        )
        self._cached_token = token_data
        return token_data["token"]
