"""Tenant-scoped GitHub App installation and repository inventory."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "024_github_inventory"
down_revision: str | None = "023_mcp_execution_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "github_installations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("github_installation_id", sa.String(255), nullable=False),
        sa.Column("account_login", sa.String(255)),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("last_webhook_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("github_installation_id", name="uq_github_installations_external_id"),
    )
    op.create_index("ix_github_installations_tenant_updated", "github_installations", ["tenant_id", "updated_at"])
    op.create_table(
        "github_repositories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("installation_id", sa.String(36), nullable=False),
        sa.Column("github_repository_id", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(512), nullable=False),
        sa.Column("private", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("default_branch", sa.String(255)),
        sa.Column("last_webhook_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "github_repository_id", name="uq_github_repositories_tenant_external_id"),
    )
    op.create_index("ix_github_repositories_tenant_installation", "github_repositories", ["tenant_id", "installation_id"])


def downgrade() -> None:
    op.drop_index("ix_github_repositories_tenant_installation", table_name="github_repositories")
    op.drop_table("github_repositories")
    op.drop_index("ix_github_installations_tenant_updated", table_name="github_installations")
    op.drop_table("github_installations")
