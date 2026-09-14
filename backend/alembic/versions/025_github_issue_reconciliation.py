"""Persist non-sensitive issue metadata for webhook execution reconciliation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "025_github_issue_reconciliation"
down_revision: str | None = "024_github_inventory"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("mcp_action_evidence", sa.Column("github_issue_number", sa.Integer()))
    op.add_column("mcp_action_evidence", sa.Column("reconciled_at", sa.DateTime(timezone=True)))
    op.create_index("ix_mcp_action_evidence_github_issue_number", "mcp_action_evidence", ["github_issue_number"])


def downgrade() -> None:
    op.drop_index("ix_mcp_action_evidence_github_issue_number", table_name="mcp_action_evidence")
    op.drop_column("mcp_action_evidence", "reconciled_at")
    op.drop_column("mcp_action_evidence", "github_issue_number")
