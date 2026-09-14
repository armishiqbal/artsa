"""Execution lifecycle fields for digest-only managed MCP evidence."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "023_mcp_execution_lifecycle"
down_revision: str | None = "022_mcp_action_evidence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mcp_action_evidence",
        sa.Column("execution_state", sa.String(32), nullable=False, server_default="PENDING"),
    )
    op.add_column("mcp_action_evidence", sa.Column("result_sha256", sa.String(64)))
    op.add_column("mcp_action_evidence", sa.Column("execution_latency_ms", sa.Integer()))
    op.add_column(
        "mcp_action_evidence", sa.Column("execution_findings", sa.JSON(), nullable=False, server_default="[]")
    )
    op.add_column("mcp_action_evidence", sa.Column("executed_at", sa.DateTime(timezone=True)))
    op.create_index("ix_mcp_action_evidence_execution_state", "mcp_action_evidence", ["execution_state"])


def downgrade() -> None:
    op.drop_index("ix_mcp_action_evidence_execution_state", table_name="mcp_action_evidence")
    op.drop_column("mcp_action_evidence", "executed_at")
    op.drop_column("mcp_action_evidence", "execution_findings")
    op.drop_column("mcp_action_evidence", "execution_latency_ms")
    op.drop_column("mcp_action_evidence", "result_sha256")
    op.drop_column("mcp_action_evidence", "execution_state")
