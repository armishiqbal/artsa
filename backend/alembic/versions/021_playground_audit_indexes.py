"""Indexes for tenant-scoped playground quota and retention queries."""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import inspect

revision: str = "021_playground_audit_indexes"
down_revision: str | None = "020_playground_run_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if "playground_run_audit" not in set(inspect(op.get_bind()).get_table_names()):
        return
    existing = {idx["name"] for idx in inspect(op.get_bind()).get_indexes("playground_run_audit")}
    if "ix_playground_audit_tenant_created" not in existing:
        op.create_index("ix_playground_audit_tenant_created", "playground_run_audit", ["tenant_id", "created_at"])
    if "ix_playground_audit_tenant_channel_created" not in existing:
        op.create_index("ix_playground_audit_tenant_channel_created", "playground_run_audit", ["tenant_id", "channel", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_playground_audit_tenant_channel_created", table_name="playground_run_audit")
    op.drop_index("ix_playground_audit_tenant_created", table_name="playground_run_audit")
