"""Add tenant-scoped, digest-only operator review labels.

Revision ID: 029_human_review_metrics
Revises: 028_custom_integration_outbox
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "029_human_review_metrics"
down_revision: str | None = "028_custom_integration_outbox"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "human_reviews",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_ref", sa.String(length=255), nullable=False),
        sa.Column("machine_verdict", sa.String(length=32), nullable=True),
        sa.Column("classification", sa.String(length=32), nullable=False),
        sa.Column("reason_code", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "source_type", "source_ref", name="uq_human_review_source"),
    )
    op.create_index("ix_human_review_tenant_created", "human_reviews", ["tenant_id", "created_at"])
    op.create_index("ix_human_reviews_tenant_id", "human_reviews", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_human_reviews_tenant_id", table_name="human_reviews")
    op.drop_index("ix_human_review_tenant_created", table_name="human_reviews")
    op.drop_table("human_reviews")
