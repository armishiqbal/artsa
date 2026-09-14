"""Signed-webhook projection for ARTSA's GitHub inventory.

Only small, allowlisted GitHub metadata is projected. The raw webhook body is
handled in request memory and discarded after this function returns.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.data.orm import GitHubInstallationORM, GitHubRepositoryORM, MCPActionEvidenceORM


async def project_signed_github_webhook(
    db: AsyncSession, *, event_name: str, payload: dict[str, Any]
) -> bool:
    """Project trusted installation/repository metadata, returning whether matched.

    An incoming GitHub event never chooses a tenant. Its installation ID must
    already have been enrolled by that tenant through the operator API.
    """
    if not hasattr(db, "execute"):
        return False
    installation = payload.get("installation")
    external_id = str(installation.get("id")) if isinstance(installation, dict) and installation.get("id") else ""
    if not external_id:
        return False
    record = (
        await db.execute(
            select(GitHubInstallationORM).where(
                GitHubInstallationORM.github_installation_id == external_id
            )
        )
    ).scalar_one_or_none()
    if record is None:
        # Unknown installations are intentionally not auto-enrolled.
        return False
    now = datetime.now(UTC)
    record.last_webhook_at = now
    if event_name == "installation":
        action = payload.get("action")
        if action == "deleted":
            record.status = "REMOVED"
        elif action in {"created", "new_permissions_accepted", "added"}:
            record.status = "ACTIVE"
        account = payload.get("installation", {}).get("account") if isinstance(payload.get("installation"), dict) else None
        if isinstance(account, dict) and isinstance(account.get("login"), str):
            record.account_login = account["login"][:255]
        permissions = payload.get("installation", {}).get("permissions") if isinstance(payload.get("installation"), dict) else None
        if isinstance(permissions, dict):
            record.permissions = {str(k)[:128]: str(v)[:64] for k, v in permissions.items()}

    repository = payload.get("repository")
    if isinstance(repository, dict) and repository.get("id") and isinstance(repository.get("full_name"), str):
        repo_id = str(repository["id"])
        row = (
            await db.execute(
                select(GitHubRepositoryORM).where(
                    GitHubRepositoryORM.tenant_id == record.tenant_id,
                    GitHubRepositoryORM.github_repository_id == repo_id,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            row = GitHubRepositoryORM(
                tenant_id=record.tenant_id,
                installation_id=record.id,
                github_repository_id=repo_id,
                full_name=repository["full_name"][:512],
            )
            db.add(row)
        else:
            row.installation_id = record.id
            row.full_name = repository["full_name"][:512]
        row.private = bool(repository.get("private", True))
        row.archived = bool(repository.get("archived", False))
        branch = repository.get("default_branch")
        row.default_branch = branch[:255] if isinstance(branch, str) else None
        row.last_webhook_at = now
        # A GitHub `issues.opened` event independently confirms that the exact
        # issue number returned from an approved create call exists. We do not
        # retain issue title/body/author or any raw webhook field.
        issue = payload.get("issue")
        issue_number = issue.get("number") if isinstance(issue, dict) else None
        if event_name == "issues" and payload.get("action") == "opened" and isinstance(issue_number, int):
            evidence_rows = (
                await db.execute(
                    select(MCPActionEvidenceORM).where(
                        MCPActionEvidenceORM.tenant_id == record.tenant_id,
                        MCPActionEvidenceORM.github_installation_id == external_id,
                        MCPActionEvidenceORM.resource == row.full_name,
                        MCPActionEvidenceORM.tool == "github_create_issue",
                        MCPActionEvidenceORM.execution_state == "EXECUTED",
                        MCPActionEvidenceORM.github_issue_number == issue_number,
                    )
                )
            ).scalars().all()
            for evidence in evidence_rows:
                evidence.reconciled_at = now
    await db.flush()
    return True


def installation_view(row: GitHubInstallationORM) -> dict[str, Any]:
    return {
        "id": row.id,
        "github_installation_id": row.github_installation_id,
        "account_login": row.account_login,
        "status": row.status,
        "permissions": row.permissions or {},
        "last_webhook_at": row.last_webhook_at,
        "created_at": row.created_at,
    }


def repository_view(row: GitHubRepositoryORM) -> dict[str, Any]:
    return {
        "id": row.id,
        "github_repository_id": row.github_repository_id,
        "full_name": row.full_name,
        "private": row.private,
        "archived": row.archived,
        "default_branch": row.default_branch,
        "last_webhook_at": row.last_webhook_at,
    }
