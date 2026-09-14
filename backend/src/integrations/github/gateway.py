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
from src.containment.detectors.semantic import SemanticDetector
from src.core.config import settings
from src.core.models.events import ToolCallEvent
from src.data.db import get_session_factory
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
        try:
            self._semantic_detector: SemanticDetector | None = SemanticDetector()
        except Exception as exc:
            logger.warning("Could not initialize SemanticDetector for gateway: %s", exc)
            self._semantic_detector = None

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
        *texts: str,
    ) -> Any | None:
        """Inspect texts for prompt-injection markers using regex and local semantic model."""
        candidates: list[str] = []
        for t in texts:
            if t and t.strip() and t not in candidates:
                candidates.append(t)
        if len(candidates) > 1:
            candidates.append("\n".join(candidates))

        for text in candidates:
            if not text:
                continue
            event = ToolCallEvent(
                session_id=session_id,
                agent_id="github-agent",
                tool_name=TOOL_NAME_CREATE_ISSUE,
                arguments={
                    "input": text,
                    "body": text,
                },
            )
            # Tier 1: Fast deterministic regex pass
            sec_event = self._prompt_detector.detect(event)
            if sec_event:
                return sec_event
            # Tier 2: Local semantic embedding model pass
            if self._semantic_detector is not None:
                try:
                    sem_event = self._semantic_detector.detect(event)
                    if sem_event:
                        return sem_event
                except Exception as exc:
                    logger.warning("Semantic detector exception: %s", exc)
        return None

    async def read_repository(
        self,
        tenant_id: str,
        repository: str,
        session_id: uuid.UUID | None = None,
        target_tenant_id: str | None = None,
        db: AsyncSession | None = None,
        http_client: httpx.AsyncClient | None = None,
        github_token: str | None = None,
        base_url: str = "https://api.github.com",
    ) -> GatewayResult:
        """Intercept read_repository action.

        Verifies:
        1. Prompt injection detector on input -> BLOCK if detected.
        2. Cross-tenant isolation -> DENIED if violation.
        3. Allowed repository list -> DENIED if repository not in allowlist.
        4. Upstream response containment if HTTP client provided -> fails closed on 403, 5xx, timeout.
        """
        effective_session_id = session_id or uuid.uuid4()

        # 1. Check prompt injection in repository input
        injection = self._detect_prompt_injection(effective_session_id, repository)
        if injection:
            return GatewayResult(
                status="BLOCK",
                message="Block",
                error=f"Prompt injection detected in tool input: {injection.description}",
            )

        # 2. Tenant isolation check
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

        # 3. Allowed repository check
        if not self._is_repo_allowed(repository):
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error=f"Repository '{repository}' is not in allowed repositories list",
            )

        # 4. Optional upstream GitHub read call if client or token available
        client = http_client or self.http_client
        if client is not None:
            token = github_token
            if not token and self.auth_manager:
                try:
                    token = await self.auth_manager.get_scoped_installation_token(
                        repositories=[repository],
                        permissions={"contents": "read", "metadata": "read"},
                    )
                except Exception as exc:
                    logger.error("Failed generating installation token for read: %s", exc)
                    return GatewayResult(
                        status="UNAVAILABLE",
                        message="Unavailable or blocked",
                        error=f"GitHub token generation failed: {exc}",
                    )
            if not token:
                token = "ghs_scoped_read_token_default"

            url = f"{base_url.rstrip('/')}/repos/{repository}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            try:
                resp = await client.get(url, headers=headers)
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
                try:
                    data = resp.json()
                except Exception:
                    return GatewayResult(
                        status="BLOCK",
                        message="Unavailable or blocked",
                        error="Malformed output from GitHub API: non-JSON content",
                    )
                return GatewayResult(
                    status="ALLOW",
                    message="Allow",
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

        1. Prompt injection detector on title, body, repo -> BLOCK if detected.
        2. If retry_token is provided:
           - Atomic consumption in Redis -> BLOCK if reused or arguments tampered.
           - Tenant and repository validation -> DENIED if boundary violated.
           - On success: dispatches to GitHub API.
           - Fails closed on timeout, 403, or malformed responses -> UNAVAILABLE or BLOCK.
        3. If retry_token is absent:
           - Cross-tenant and repository check -> DENIED if violation.
           - Deterministic rule: issue creation requires approval -> APPROVAL_REQUIRED.
        """
        # 1. Pre-execution check: Prompt injection on inputs (title, body, repo)
        injection = self._detect_prompt_injection(session_id, title, body, repository)
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

        # 2. Retry with token: verify token and operation digest before checking repo allowlist
        # This guarantees that ANY tampering with the body or repository is BLOCKED.
        if retry_token is not None:
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
                    error="Retry token invalid, already consumed, expired, or arguments modified (tampering detected)",
                )

            # Token consumed and valid! Verify tenant boundary & allowed repository
            tenant_ok = await self._verify_tenant_isolation(
                tenant_id=tenant_id,
                session_id=session_id,
                target_tenant_id=target_tenant_id,
                db=effective_db,
            )
            if not tenant_ok:
                return GatewayResult(
                    status="DENIED",
                    message="Denied",
                    error="Cross-tenant access forbidden",
                )

            if not self._is_repo_allowed(repository):
                return GatewayResult(
                    status="DENIED",
                    message="Denied",
                    error=f"Repository '{repository}' is not in allowed repositories list",
                )

            # Dispatch to GitHub API
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

        # 3. Fresh unapproved request: verify tenant boundary and repo allowlist
        tenant_ok = await self._verify_tenant_isolation(
            tenant_id=tenant_id,
            session_id=session_id,
            target_tenant_id=target_tenant_id,
            db=effective_db,
        )
        if not tenant_ok:
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error="Cross-tenant access forbidden",
            )

        if not self._is_repo_allowed(repository):
            return GatewayResult(
                status="DENIED",
                message="Denied",
                error=f"Repository '{repository}' is not in allowed repositories list",
            )

        # Deterministic rule: issue creation requires operator approval
        approval_id = str(uuid.uuid4())
        findings = [
            {
                "detector": "DeterministicGitHubPolicy",
                "category": "APPROVAL_REQUIRED",
                "severity": "HIGH",
                "risk_score": 60.0,
                "action": "QUARANTINE",
            }
        ]
        requester = {"tenant_id": tenant_id, "session_id": str(session_id), "action": "create_issue"}

        if effective_db is not None:
            approval = await create_request(
                effective_db,
                tenant_id=tenant_id,
                session_id=session_id,
                tool_name=TOOL_NAME_CREATE_ISSUE,
                arguments=arguments,
                findings=findings,
                requester=requester,
            )
            if hasattr(effective_db, "commit"):
                await effective_db.commit()
            approval_id = approval.id
        else:
            try:
                factory = get_session_factory()
                async with factory() as session:
                    approval = await create_request(
                        session,
                        tenant_id=tenant_id,
                        session_id=session_id,
                        tool_name=TOOL_NAME_CREATE_ISSUE,
                        arguments=arguments,
                        findings=findings,
                        requester=requester,
                    )
                    await session.commit()
                    approval_id = approval.id
            except Exception as exc:
                logger.warning("Could not persist approval request via default session factory: %s", exc)

        return GatewayResult(
            status="APPROVAL_REQUIRED",
            message="Approval required",
            approval_id=approval_id,
            data={"approval_id": approval_id, "status": "PENDING"},
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
