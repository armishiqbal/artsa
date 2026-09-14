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

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + min(expire_seconds, 600),
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
    - Scoped repositories list (defaults to settings.GITHUB_ALLOWED_REPOSITORIES)
    - Narrow permissions (issues: write, contents: read, metadata: read)
    """
    effective_inst_id = installation_id or settings.GITHUB_INSTALLATION_ID
    if not effective_inst_id:
        raise ValueError("GitHub Installation ID must be provided or configured in settings")

    effective_perms = permissions if permissions is not None else DEFAULT_NARROW_PERMISSIONS
    raw_repos = repositories if repositories is not None else settings.GITHUB_ALLOWED_REPOSITORIES
    # GitHub accepts repo names without owner (e.g. 'repo-name') or full names
    scoped_repos = [r.split("/")[-1] for r in raw_repos] if raw_repos else []

    app_jwt = generate_app_jwt(app_id=app_id, private_key=private_key)

    url = f"{base_url.rstrip('/')}/app/installations/{effective_inst_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body: dict[str, Any] = {
        "permissions": effective_perms,
    }
    if scoped_repos:
        body["repositories"] = scoped_repos

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
