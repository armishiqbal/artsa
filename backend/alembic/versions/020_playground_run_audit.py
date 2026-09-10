"""Digest-only audit and quota ledger for AI Security Playground."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "020_playground_run_audit"
down_revision: str | None = "019_tenant_scoped_providers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if "playground_run_audit" in set(inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        "playground_run_audit",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False, index=True),
        sa.Column("actor_id", sa.String(255), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=False, index=True),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("channel", sa.String(32), nullable=False),
        sa.Column("provider_id", sa.String(36), nullable=True),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("request_sha256", sa.String(64), nullable=False),
        sa.Column("response_sha256", sa.String(64), nullable=True),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("findings", sa.JSON(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_tokens", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    if "playground_run_audit" in set(inspect(op.get_bind()).get_table_names()):
        op.drop_table("playground_run_audit")
