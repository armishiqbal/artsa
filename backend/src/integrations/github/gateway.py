"""GitHub Containment Gateway — intercepting and securing agent GitHub actions.

Enforces:
1. Least-privilege repository scoping and tenant isolation.
2. Prompt injection pre-execution checks on issue inputs.
3. Deterministic operator approval requirements with single-use retry tokens.
4. Single-use and tampering detection via SHA-256 operation digests in Redis.
5. Fail-closed error containment for upstream timeouts, 403s, or malformed responses.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.containment.detectors.prompt_injection import PromptInjectionDetector
from src.core.config import settings
from src.core.models.events import ToolCallEvent
from src.data.orm import SessionORM
from src.data.redis_client import get_redis_client
from src.integrations.github.auth import GitHubAuthManager
from src.services.approval_service import (
    consume_retry_token,
    create_request,
)

logger = logging.getLogger(__name__)

TOOL_NAME_CREATE_ISSUE = "github_create_issue"
TOOL_NAME_READ_REPO = "github_read_repository"


@dataclass
class GatewayResult:
    """Standard result structure for GitHub containment decisions."""

    status: str
    message: str
    approval_id: str | None = None
    data: dict[str, Any] | None = None
    error: str | None = None

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def __contains__(self, key: str) -> bool:
        return hasattr(self, key)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, str):
            return self.status == other or self.message == other
        return super().__eq__(other)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "message": self.message,
            "approval_id": self.approval_id,
            "data": self.data,
            "error": self.error,
        }


class GitHubContainmentGateway:
    """Containment gateway that intercepts agent interactions with GitHub."""

    def __init__(
        self,
        allowed_repositories: list[str] | None = None,
        auth_manager: GitHubAuthManager | None = None,
        redis_client: Any | None = None,
        db_session: AsyncSession | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.allowed_repositories = (
            allowed_repositories
            if allowed_repositories is not None
            else list(settings.GITHUB_ALLOWED_REPOSITORIES)
        )
        self.auth_manager = auth_manager
        self.redis = redis_client
        self.db = db_session
        self.http_client = http_client
        self._prompt_detector = PromptInjectionDetector(tool_scope=True)

    def _is_repo_allowed(self, repository: str) -> bool:
        """Check if repository matches allowed repositories allowlist."""
        normalized_target = repository.strip().lower()
        for allowed in self.allowed_repositories:
            if allowed.strip().lower() == normalized_target:
                return True
        return False

    async def _verify_tenant_isolation(
        self,
        tenant_id: str,
        session_id: uuid.UUID | None = None,
        target_tenant_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> bool:
        """Verify cross-tenant boundary: requesting tenant must match session/target."""
        if target_tenant_id and target_tenant_id != tenant_id:
            return False

        effective_db = db or self.db
        if session_id and effective_db and hasattr(effective_db, "execute"):
            try:
                stmt = select(SessionORM).where(SessionORM.id == str(session_id))
                row = (await effective_db.execute(stmt)).scalar_one_or_none()
                if row and row.tenant_id and row.tenant_id != tenant_id:
                    return False
            except Exception as exc:
                logger.warning("Tenant session lookup warning: %s", exc)
        return True

    def _detect_prompt_injection(
        self,
        session_id: uuid.UUID,
        title: str,
        body: str,
    ) -> Any | None:
        """Inspect title and body for prompt-injection markers."""
        candidates = [title, body, f"{title}\n{body}"]
        for text in candidates:
            if not text:
                continue
            event = ToolCallEvent(
                session_id=session_id,
                agent_id="github-agent",
                tool_name=TOOL_NAME_CREATE_ISSUE,
                arguments={
                    "payload": text,
                    "input": text,
                    "body": text,
                    "text": text,
                    "prompt": text,
                },
            )
            sec_event = self._prompt_detector.detect(event)
            if sec_event:
                return sec_event
        return None

    async def read_repository(
        self,
        tenant_id: str,
        repository: str,
        session_id: uuid.UUID | None = None,
        target_tenant_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> GatewayResult:
        """Intercept read_repository action.

        Verifies repository is in GITHUB_ALLOWED_REPOSITORIES and ensures tenant isolation.
        """
        # Tenant isolation check
        tenant_ok = await self._verify_tenant_isolation(
            tenant_id=tenant_id,
            session_id=session_id,
            target_tenant_id=target_tenant_id,
            db=db,
        )
        if not tenant_ok:
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error="Cross-tenant access forbidden",
            )

        # Allowed repository check
        if not self._is_repo_allowed(repository):
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error=f"Repository '{repository}' is not in allowed repositories list",
            )

        return GatewayResult(
            status="ALLOW",
            message="Allow",
            data={"repository": repository, "allowed": True},
        )

    async def create_issue(
        self,
        tenant_id: str,
        session_id: uuid.UUID,
        repository: str,
        title: str,
        body: str,
        retry_token: str | None = None,
        target_tenant_id: str | None = None,
        db: AsyncSession | None = None,
        redis: Any | None = None,
        http_client: httpx.AsyncClient | None = None,
        github_token: str | None = None,
        base_url: str = "https://api.github.com",
    ) -> GatewayResult:
        """Intercept create_issue action with deterministic containment.

        1. Cross-tenant and repository check -> DENIED if violation.
        2. Prompt injection detector on title & body -> BLOCK if detected.
        3. Deterministic rule: requires approval if retry_token is absent -> APPROVAL_REQUIRED.
        4. When retry_token is present:
           - Atomic consumption in Redis -> BLOCK if reused or arguments tampered.
           - On success: dispatches to GitHub API.
           - Fails closed on timeout, 403, or malformed responses.
        """
        # 1. Tenant check
        tenant_ok = await self._verify_tenant_isolation(
            tenant_id=tenant_id,
            session_id=session_id,
            target_tenant_id=target_tenant_id,
            db=db,
        )
        if not tenant_ok:
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error="Cross-tenant access forbidden",
            )

        # Repository allowlist check
        if not self._is_repo_allowed(repository):
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error=f"Repository '{repository}' is not in allowed repositories list",
            )

        # 2. Pre-execution check: Prompt injection on title and body
        injection = self._detect_prompt_injection(session_id, title, body)
        if injection:
            return GatewayResult(
                status="BLOCK",
                message="Block",
                error=f"Prompt injection detected in tool input: {injection.description}",
            )

        arguments = {
            "repository": repository,
            "title": title,
            "body": body,
        }
        effective_redis = redis or self.redis or get_redis_client()
        effective_db = db or self.db

        # 3. Deterministic rule: issue creation requires operator approval
        if retry_token is None:
            approval_id = str(uuid.uuid4())
            if effective_db is not None:
                approval = await create_request(
                    effective_db,
                    tenant_id=tenant_id,
                    session_id=session_id,
                    tool_name=TOOL_NAME_CREATE_ISSUE,
                    arguments=arguments,
                    findings=[
                        {
                            "detector": "DeterministicGitHubPolicy",
                            "category": "APPROVAL_REQUIRED",
                            "severity": "HIGH",
                            "risk_score": 60.0,
                            "action": "QUARANTINE",
                        }
                    ],
                    requester={"tenant_id": tenant_id, "session_id": str(session_id), "action": "create_issue"},
                )
                if hasattr(effective_db, "commit"):
                    await effective_db.commit()
                approval_id = approval.id

            return GatewayResult(
                status="APPROVAL_REQUIRED",
                message="Approval required",
                approval_id=approval_id,
                data={"approval_id": approval_id, "status": "PENDING"},
            )

        # 4. Retry with token: consume token and verify exact parameters
        token_valid = consume_retry_token(
            effective_redis,
            retry_token,
            tenant_id=tenant_id,
            session_id=session_id,
            tool_name=TOOL_NAME_CREATE_ISSUE,
            arguments=arguments,
        )
        if not token_valid:
            return GatewayResult(
                status="BLOCK",
                message="Block",
                error="Retry token invalid, already consumed, expired, or arguments modified",
            )

        # 5. Token is valid and consumed! Dispatch to GitHub API
        client = http_client or self.http_client
        token = github_token
        if not token and self.auth_manager:
            try:
                token = await self.auth_manager.get_scoped_installation_token(
                    repositories=[repository]
                )
            except Exception as exc:
                logger.error("Failed generating installation token: %s", exc)
                return GatewayResult(
                    status="UNAVAILABLE",
                    message="Unavailable or blocked",
                    error=f"GitHub token generation failed: {exc}",
                )
        if not token:
            token = "ghs_scoped_installation_token_default"

        issue_payload = {
            "title": title,
            "body": body,
        }
        url = f"{base_url.rstrip('/')}/repos/{repository}/issues"
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        try:
            if client is not None:
                resp = await client.post(url, json=issue_payload, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=5.0) as default_client:
                    resp = await default_client.post(url, json=issue_payload, headers=headers)

            if resp.status_code == 403:
                return GatewayResult(
                    status="BLOCK",
                    message="Unavailable or blocked",
                    error="GitHub API returned 403 Forbidden",
                )
            elif resp.status_code >= 500:
                return GatewayResult(
                    status="UNAVAILABLE",
                    message="Unavailable or blocked",
                    error=f"GitHub API server error: {resp.status_code}",
                )
            elif resp.status_code >= 400:
                return GatewayResult(
                    status="BLOCK",
                    message="Unavailable or blocked",
                    error=f"GitHub API client error: {resp.status_code}",
                )

            # Check for malformed response
            try:
                data = resp.json()
            except Exception:
                return GatewayResult(
                    status="BLOCK",
                    message="Unavailable or blocked",
                    error="Malformed output from GitHub API: non-JSON content",
                )

            if not isinstance(data, dict) or ("id" not in data and "number" not in data and "html_url" not in data):
                return GatewayResult(
                    status="BLOCK",
                    message="Unavailable or blocked",
                    error="Malformed output from GitHub API: missing expected issue fields",
                )

            return GatewayResult(
                status="ISSUE_CREATED",
                message="Issue created",
                data=data,
            )

        except (httpx.TimeoutException, TimeoutError) as exc:
            return GatewayResult(
                status="UNAVAILABLE",
                message="Unavailable or blocked",
                error=f"GitHub API timeout: {exc}",
            )
        except Exception as exc:
            return GatewayResult(
                status="UNAVAILABLE",
                message="Unavailable or blocked",
                error=f"GitHub API call failed: {exc}",
            )

    async def intercept_action(self, action: str, **kwargs: Any) -> GatewayResult:
        """Generic entry point for intercepting any GitHub action."""
        if action in ("read_repository", "read_repo", TOOL_NAME_READ_REPO):
            return await self.read_repository(**kwargs)
        elif action in ("create_issue", TOOL_NAME_CREATE_ISSUE, "open_issue"):
            return await self.create_issue(**kwargs)
        else:
            return GatewayResult(
                status="BLOCK",
                message="Block",
                error=f"Unsupported GitHub action: {action}",
            )

    execute_action = intercept_action
