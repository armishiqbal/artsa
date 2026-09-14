"""Digest-only evidence ledger for managed MCP actions."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "022_mcp_action_evidence"
down_revision: str | None = "022_runtime_audit_evidence_expansion"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_action_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("action_id", sa.String(36), nullable=False),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("trace_id", sa.String(255), nullable=False),
        sa.Column("agent_id", sa.String(255), nullable=False),
        sa.Column("actor_id", sa.String(255)), sa.Column("integration", sa.String(64), nullable=False),
        sa.Column("github_installation_id", sa.String(255), nullable=False),
        sa.Column("tool", sa.String(128), nullable=False), sa.Column("resource", sa.String(512), nullable=False),
        sa.Column("operation", sa.String(128), nullable=False), sa.Column("arguments_sha256", sa.String(64), nullable=False),
        sa.Column("source_trust", sa.String(32), nullable=False), sa.Column("data_classification", sa.String(32), nullable=False),
        sa.Column("policy_version", sa.String(128), nullable=False), sa.Column("outcome", sa.String(32), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False), sa.Column("finding_categories", sa.JSON(), nullable=False),
        sa.Column("detector_version", sa.String(128), nullable=False), sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("approval_id", sa.String(36)), sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "action_id", name="uq_mcp_action_evidence_tenant_action"),
    )
    op.create_index("ix_mcp_action_evidence_tenant_created", "mcp_action_evidence", ["tenant_id", "created_at"])
    op.create_index("ix_mcp_action_evidence_github_installation", "mcp_action_evidence", ["github_installation_id"])


def downgrade() -> None:
    op.drop_index("ix_mcp_action_evidence_github_installation", table_name="mcp_action_evidence")
    op.drop_index("ix_mcp_action_evidence_tenant_created", table_name="mcp_action_evidence")
    op.drop_table("mcp_action_evidence")
