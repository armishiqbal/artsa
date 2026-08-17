"""Add structured risk_score column to alerts.

Alerts previously embedded risk only inside the message string
("risk 92.5"); dispatchers re-parsed it with a regex. This migration
persists the value as a first-class column so downstream consumers
(webhook/SIEM payloads, Mongo sink, custom connectors) read
Alert.risk_score directly instead of string-parsing.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007_alert_risk_score"
down_revision: Union[str, None] = "006_profile_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "alerts",
        sa.Column("risk_score", sa.Float(), nullable=False, server_default="70.0"),
    )


def downgrade() -> None:
    op.drop_column("alerts", "risk_score")
