"""Add encrypted, replayable custom-integration outbox.

Revision ID: 028_custom_integration_outbox
Revises: 027_custom_integration_delivery_ledger
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "028_custom_integration_outbox"
down_revision: str | None = "027_custom_integration_delivery_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "custom_integration_outbox",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("integration_name", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("delivery_id", sa.String(length=128), nullable=False),
        sa.Column("correlation_id", sa.String(length=255), nullable=False),
        sa.Column("payload_sha256", sa.String(length=64), nullable=False),
        sa.Column("event_ciphertext", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "tenant_id", "integration_name", "delivery_id",
            name="uq_custom_integration_outbox_delivery",
        ),
    )
    op.create_index(
        "ix_custom_integration_outbox_pending",
        "custom_integration_outbox",
        ["status", "created_at"],
    )
    op.create_index("ix_custom_integration_outbox_tenant_id", "custom_integration_outbox", ["tenant_id"])
    op.create_index(
        "ix_custom_integration_outbox_integration_name",
        "custom_integration_outbox",
        ["integration_name"],
    )


def downgrade() -> None:
    op.drop_index("ix_custom_integration_outbox_integration_name", table_name="custom_integration_outbox")
    op.drop_index("ix_custom_integration_outbox_tenant_id", table_name="custom_integration_outbox")
    op.drop_index("ix_custom_integration_outbox_pending", table_name="custom_integration_outbox")
    op.drop_table("custom_integration_outbox")
