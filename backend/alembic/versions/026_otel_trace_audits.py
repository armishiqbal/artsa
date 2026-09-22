"""Persist digest-only OTEL trace analysis evidence.

Raw OpenTelemetry span attributes are intentionally excluded because they may
contain prompts, model output, secrets, or PII.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "026_otel_trace_audits"
down_revision: str | None = "025_github_issue_reconciliation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "otel_trace_audits",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("trace_id", sa.String(length=255), nullable=False),
        sa.Column("resource_sha256", sa.String(length=64), nullable=False),
        sa.Column("spans_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_drift_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("exploit_alert_triggered", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("detected_threats", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "trace_id", name="uq_otel_trace_audit_tenant_trace"),
    )
    op.create_index("ix_otel_trace_audit_tenant_created", "otel_trace_audits", ["tenant_id", "created_at"])
    op.create_index("ix_otel_trace_audits_tenant_id", "otel_trace_audits", ["tenant_id"])
    op.create_index("ix_otel_trace_audits_trace_id", "otel_trace_audits", ["trace_id"])


def downgrade() -> None:
    op.drop_index("ix_otel_trace_audits_trace_id", table_name="otel_trace_audits")
    op.drop_index("ix_otel_trace_audits_tenant_id", table_name="otel_trace_audits")
    op.drop_index("ix_otel_trace_audit_tenant_created", table_name="otel_trace_audits")
    op.drop_table("otel_trace_audits")
