"""Custom outbound integration connectors table.

User-defined connectors that push ARTSA alerts/telemetry to any HTTP system.
Secrets are Fernet-encrypted at rest (see src.utils.crypto) — the column holds
ciphertext, never plaintext.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_custom_integrations"
down_revision: Union[str, None] = "002_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "custom_integrations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("description", sa.String(512), nullable=True),
        sa.Column("method", sa.String(8), nullable=False, server_default="POST"),
        sa.Column("target_url", sa.String(1024), nullable=False),
        sa.Column("auth_type", sa.String(16), nullable=False, server_default="none"),
        sa.Column("headers", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("payload_template", sa.Text(), nullable=True),
        sa.Column("event_types", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("risk_threshold", sa.Float(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("timeout", sa.Float(), nullable=False, server_default="10"),
        sa.Column("secrets", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("custom_integrations")
