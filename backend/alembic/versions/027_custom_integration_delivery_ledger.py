"""Persist metadata-only custom-integration delivery outcomes.

Revision ID: 027_custom_integration_delivery_ledger
Revises: 026_otel_trace_audits
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "027_custom_integration_delivery_ledger"
down_revision: str | None = "026_otel_trace_audits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "custom_integration_deliveries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("integration_name", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("delivery_id", sa.String(length=128), nullable=False),
        sa.Column("correlation_id", sa.String(length=255), nullable=False),
        sa.Column("payload_sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("failure_code", sa.String(length=64), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "tenant_id", "integration_name", "delivery_id",
            name="uq_custom_integration_delivery",
        ),
    )
    op.create_index(
        "ix_custom_integration_delivery_tenant_created",
        "custom_integration_deliveries",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "ix_custom_integration_deliveries_tenant_id",
        "custom_integration_deliveries",
        ["tenant_id"],
    )
    op.create_index(
        "ix_custom_integration_deliveries_integration_name",
        "custom_integration_deliveries",
        ["integration_name"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_custom_integration_deliveries_integration_name",
        table_name="custom_integration_deliveries",
    )
    op.drop_index(
        "ix_custom_integration_deliveries_tenant_id",
        table_name="custom_integration_deliveries",
    )
    op.drop_index(
        "ix_custom_integration_delivery_tenant_created",
        table_name="custom_integration_deliveries",
    )
    op.drop_table("custom_integration_deliveries")
