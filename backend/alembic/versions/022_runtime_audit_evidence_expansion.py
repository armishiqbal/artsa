"""Add correlation_id, tenant_id, actor_id, agent_id, provider_id, model, latency_ms to runtime_enforcement_audit."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "022_runtime_audit_evidence_expansion"
down_revision: str | None = "021_playground_audit_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "runtime_enforcement_audit" not in tables:
        return
    cols = {c["name"] for c in inspect(bind).get_columns("runtime_enforcement_audit")}

    if "correlation_id" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("correlation_id", sa.String(64), nullable=True))
        op.create_index("ix_runtime_enforcement_audit_correlation_id", "runtime_enforcement_audit", ["correlation_id"])
    if "tenant_id" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("tenant_id", sa.String(255), nullable=True))
        op.create_index("ix_runtime_enforcement_audit_tenant_id", "runtime_enforcement_audit", ["tenant_id"])
    if "actor_id" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("actor_id", sa.String(255), nullable=True))
    if "agent_id" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("agent_id", sa.String(255), nullable=True))
        op.create_index("ix_runtime_enforcement_audit_agent_id", "runtime_enforcement_audit", ["agent_id"])
    if "provider_id" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("provider_id", sa.String(64), nullable=True))
    if "model" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("model", sa.String(255), nullable=True))
    if "latency_ms" not in cols:
        op.add_column("runtime_enforcement_audit", sa.Column("latency_ms", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if "runtime_enforcement_audit" not in tables:
        return
    cols = {c["name"] for c in inspect(bind).get_columns("runtime_enforcement_audit")}

    if "latency_ms" in cols:
        op.drop_column("runtime_enforcement_audit", "latency_ms")
    if "model" in cols:
        op.drop_column("runtime_enforcement_audit", "model")
    if "provider_id" in cols:
        op.drop_column("runtime_enforcement_audit", "provider_id")
    if "agent_id" in cols:
        op.drop_index("ix_runtime_enforcement_audit_agent_id", table_name="runtime_enforcement_audit")
        op.drop_column("runtime_enforcement_audit", "agent_id")
    if "actor_id" in cols:
        op.drop_column("runtime_enforcement_audit", "actor_id")
    if "tenant_id" in cols:
        op.drop_index("ix_runtime_enforcement_audit_tenant_id", table_name="runtime_enforcement_audit")
        op.drop_column("runtime_enforcement_audit", "tenant_id")
    if "correlation_id" in cols:
        op.drop_index("ix_runtime_enforcement_audit_correlation_id", table_name="runtime_enforcement_audit")
        op.drop_column("runtime_enforcement_audit", "correlation_id")
