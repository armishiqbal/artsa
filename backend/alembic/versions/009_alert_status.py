"""WS-3.3: incident workflow — add status column to alerts (NEW/ACKNOWLEDGED/RESOLVED)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009_alert_status"
down_revision: str | None = "008_tenant_isolation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "alerts",
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="NEW",
        ),
    )


def downgrade() -> None:
    op.drop_column("alerts", "status")
