"""WS-3.1: row-level tenant isolation — add tenant_id to remaining tables.

Sessions, tool events, agents, and alert rules already carry tenant_id.
This migration adds the column to the tables that still store tenant-agnostic
rows so every tenant-scoped query can isolate org data:
alerts, event_evaluations, custom_integrations, campaign_jobs, agent_baselines.

Note: ``agent_baselines`` (and any table the chain never created) is skipped —
those are created at runtime by ``Base.metadata.create_all`` and have no
migration to alter.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "008_tenant_isolation"
down_revision: str | None = "007_alert_risk_score"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = (
    "alerts",
    "event_evaluations",
    "custom_integrations",
    "campaign_jobs",
    "agent_baselines",
)


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(inspect(bind).get_table_names())
    for table in _TABLES:
        if table not in existing:
            continue
        op.add_column(
            table,
            sa.Column(
                "tenant_id",
                sa.String(length=255),
                nullable=False,
                server_default="default_tenant",
            ),
        )
        op.create_index(f"ix_{table}_tenant_id", table, ["tenant_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    existing = set(inspect(bind).get_table_names())
    for table in reversed(_TABLES):
        if table not in existing:
            continue
        op.drop_index(f"ix_{table}_tenant_id", table_name=table)
        op.drop_column(table, "tenant_id")
