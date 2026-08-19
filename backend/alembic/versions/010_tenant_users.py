"""WS-3.1 hardening: users table gains a home tenant (identity -> tenant binding)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "010_tenant_users"
down_revision: str | None = "009_alert_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "tenant_id",
            sa.String(length=255),
            nullable=False,
            server_default="default_org",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "tenant_id")
