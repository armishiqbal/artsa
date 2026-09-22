"""Persist bounded decision lineage on event evaluations.

Revision ID: 030_event_evaluation_lineage
Revises: 029_human_review_metrics
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "030_event_evaluation_lineage"
down_revision: str | None = "029_human_review_metrics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "event_evaluations",
        sa.Column("evaluation_contract_version", sa.String(length=32), nullable=False, server_default="1.0"),
    )
    op.add_column(
        "event_evaluations",
        sa.Column("policy_version", sa.String(length=64), nullable=False, server_default="0"),
    )
    op.add_column(
        "event_evaluations",
        sa.Column("embedding_model", sa.String(length=128), nullable=False, server_default="unknown"),
    )
    op.add_column(
        "event_evaluations",
        sa.Column("detector_ids", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("event_evaluations", "detector_ids")
    op.drop_column("event_evaluations", "embedding_model")
    op.drop_column("event_evaluations", "policy_version")
    op.drop_column("event_evaluations", "evaluation_contract_version")
