"""Least-privilege GitHub Cloud client for ARTSA-managed MCP actions.

This adapter intentionally does not proxy arbitrary GitHub REST calls.  It
knows only the bounded v1 read catalog; a future execution coordinator will
invoke write handlers only after consuming a scope-bound approval.  Raw GitHub
responses remain in memory for the current request and are never written to
ARTSA evidence or logs by this module.
"""

from __future__ import annotations

import hmac
import time
from dataclasses import dataclass
from hashlib import sha256
from typing import Any
from urllib.parse import quote

import httpx
import jwt

from src.core.config import settings
from src.services.mcp_gateway import GITHUB_READ_TOOLS

_GITHUB_CLOUD_API = "https://api.github.com"


class GitHubConfigurationError(RuntimeError):
    """Raised when a managed GitHub operation cannot be safely configured."""


class GitHubToolNotSupported(ValueError):
    """Raised for calls outside ARTSA's intentionally small GitHub catalog."""


@dataclass(frozen=True)
class GitHubInstallationToken:
    """Ephemeral installation token; callers must not persist or log it."""

    token: str
    expires_at: str | None


@dataclass(frozen=True)
class GitHubToolResult:
    """In-memory adapter response; this object must not be used as evidence."""

    status_code: int
    data: Any
    rate_limit_remaining: str | None


def verify_github_webhook_signature(
    body: bytes, signature: str | None, secret: str | None = None
) -> bool:
    """Verify GitHub's SHA-256 signature without parsing untrusted payloads."""
    webhook_secret = secret if secret is not None else settings.ARTSA_GITHUB_WEBHOOK_SECRET
    if not webhook_secret or not signature or not signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        webhook_secret.encode("utf-8"), body, sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


class GitHubAppClient:
    """GitHub App installation-token client restricted to GitHub Cloud."""

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        configured_url = settings.ARTSA_GITHUB_API_URL.rstrip("/")
        if configured_url != _GITHUB_CLOUD_API:
            raise GitHubConfigurationError(
                "GitHub Enterprise Server and arbitrary API targets are not supported in v1"
            )
        self._client = client
        self._owns_client = client is None

    @staticmethod
    def configured() -> bool:
        return bool(settings.ARTSA_GITHUB_APP_ID and settings.ARTSA_GITHUB_APP_PRIVATE_KEY)

    def _app_jwt(self) -> str:
        if not self.configured():
            raise GitHubConfigurationError("GitHub App credentials are not configured")
        now = int(time.time())
        return jwt.encode(
            {"iat": now - 30, "exp": now + 9 * 60, "iss": settings.ARTSA_GITHUB_APP_ID},
            settings.ARTSA_GITHUB_APP_PRIVATE_KEY,
            algorithm="RS256",
        )

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=_GITHUB_CLOUD_API,
                timeout=httpx.Timeout(10.0),
                headers={"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None and self._owns_client:
            await self._client.aclose()

    async def installation_token(
        self,
        installation_id: str,
        *,
        repository: str | None = None,
        permissions: dict[str, str] | None = None,
    ) -> GitHubInstallationToken:
        """Mint a short-lived token only after the gateway permits execution."""
        client = await self._http()
        # GitHub supports repository and permission-scoped installation tokens.
        # Never mint a broad token for a single-repository managed action.
        token_scope: dict[str, Any] = {}
        if repository:
            token_scope["repositories"] = [repository]
        if permissions:
            token_scope["permissions"] = permissions
        response = await client.post(
            f"/app/installations/{quote(installation_id, safe='')}/access_tokens",
            headers={"Authorization": f"Bearer {self._app_jwt()}"},
            json=token_scope or None,
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("token")
        if not isinstance(token, str) or not token:
            raise GitHubConfigurationError("GitHub installation-token response was malformed")
        return GitHubInstallationToken(token=token, expires_at=payload.get("expires_at"))

    @staticmethod
    def _repository_parts(resource: str) -> tuple[str, str]:
        parts = resource.split("/")
        if len(parts) != 2 or not all(parts):
            raise GitHubToolNotSupported("resource must be an owner/repository identifier")
        return parts[0], parts[1]

    async def execute_read(
        self, *, installation_id: str, tool: str, resource: str, arguments: dict[str, Any]
    ) -> GitHubToolResult:
        """Execute one bounded, gateway-authorized read operation.

        The caller is responsible for enforcing an ``ALLOW`` decision before
        reaching this method.  No write route exists here yet by design.
        """
        if tool not in GITHUB_READ_TOOLS:
            raise GitHubToolNotSupported(f"tool '{tool}' is not an allowed GitHub read")
        path: str
        params: dict[str, str] | None = None
        repository_name: str | None = None
        if tool == "github_list_repositories":
            path = "/installation/repositories"
        else:
            owner, repo = self._repository_parts(resource)
            repository_name = repo
            prefix = f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}"
            if tool == "github_get_repository":
                path = prefix
            elif tool == "github_list_issues":
                path = f"{prefix}/issues"
            elif tool == "github_get_issue":
                path = f"{prefix}/issues/{self._required_positive_int(arguments, 'issue_number')}"
            elif tool == "github_list_pull_requests":
                path = f"{prefix}/pulls"
            elif tool == "github_get_pull_request":
                path = f"{prefix}/pulls/{self._required_positive_int(arguments, 'pull_number')}"
            elif tool == "github_get_file_contents":
                file_path = arguments.get("path")
                path_parts = file_path.strip().split("/") if isinstance(file_path, str) else []
                if (
                    not isinstance(file_path, str)
                    or not file_path.strip()
                    or file_path.startswith("/")
                    or any(part in {"", ".", ".."} for part in path_parts)
                ):
                    raise GitHubToolNotSupported("path must be a non-empty repository-relative path")
                path = f"{prefix}/contents/{quote(file_path.strip(), safe='/')}"
                ref = arguments.get("ref")
                params = {"ref": ref} if isinstance(ref, str) and ref else None
            else:  # Defensive guard if the catalog changes without a handler.
                raise GitHubToolNotSupported(f"tool '{tool}' has no v1 handler")
        token = await self.installation_token(
            installation_id,
            repository=repository_name,
            permissions=self._read_permissions(tool),
        )
        client = await self._http()
        headers = {"Authorization": f"Bearer {token.token}"}
        response = await client.get(path, headers=headers, params=params)
        response.raise_for_status()
        return GitHubToolResult(
            status_code=response.status_code,
            data=response.json(),
            rate_limit_remaining=response.headers.get("x-ratelimit-remaining"),
        )

    async def execute_create_issue(
        self, *, installation_id: str, resource: str, arguments: dict[str, Any]
    ) -> GitHubToolResult:
        """Create one repository-scoped issue after ARTSA approval consumption."""
        owner, repository = self._repository_parts(resource)
        title = arguments.get("title")
        body = arguments.get("body")
        if not isinstance(title, str) or not title.strip() or len(title) > 256:
            raise GitHubToolNotSupported("title must be a non-empty string up to 256 characters")
        if body is not None and (not isinstance(body, str) or len(body) > 65_536):
            raise GitHubToolNotSupported("body must be a string up to 65536 characters")
        token = await self.installation_token(
            installation_id,
            repository=repository,
            permissions={"issues": "write"},
        )
        payload: dict[str, str] = {"title": title.strip()}
        if isinstance(body, str):
            payload["body"] = body
        client = await self._http()
        response = await client.post(
            f"/repos/{quote(owner, safe='')}/{quote(repository, safe='')}/issues",
            headers={"Authorization": f"Bearer {token.token}"},
            json=payload,
        )
        response.raise_for_status()
        response_data = response.json()
        if not isinstance(response_data, dict):
            raise GitHubConfigurationError("GitHub issue-create response was malformed")
        return GitHubToolResult(
            status_code=response.status_code,
            data=response_data,
            rate_limit_remaining=response.headers.get("x-ratelimit-remaining"),
        )

    @staticmethod
    def _required_positive_int(arguments: dict[str, Any], name: str) -> int:
        value = arguments.get(name)
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise GitHubToolNotSupported(f"{name} must be a positive integer")
        return value

    @staticmethod
    def _read_permissions(tool: str) -> dict[str, str]:
        if tool in {"github_get_issue", "github_list_issues"}:
            return {"issues": "read"}
        if tool in {"github_get_pull_request", "github_list_pull_requests"}:
            return {"pull_requests": "read"}
        if tool == "github_get_file_contents":
            return {"contents": "read"}
        return {"metadata": "read"}
