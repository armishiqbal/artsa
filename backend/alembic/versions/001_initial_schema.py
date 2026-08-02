"""Initial schema — tool events, sessions, evaluations, campaign jobs."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tool_call_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False, index=True),
        sa.Column("agent_id", sa.String(255), nullable=False),
        sa.Column("tool_name", sa.String(255), nullable=False),
        sa.Column("arguments", sa.JSON(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trace_id", sa.String(255), nullable=False),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
    )
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agent_id", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tool_call_count", sa.Integer(), nullable=False),
        sa.Column("max_risk_score", sa.Float(), nullable=False),
        sa.Column("containment_breaches", sa.Integer(), nullable=False),
    )
    op.create_table(
        "event_evaluations",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False, index=True),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("verdict", sa.String(32), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("recommended_action", sa.String(32), nullable=False),
        sa.Column("flags", sa.JSON(), nullable=False),
        sa.Column("security_event_count", sa.Integer(), nullable=False),
    )
    op.create_table(
        "campaign_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("model", sa.String(128), nullable=False),
        sa.Column("attack_profile", sa.String(64), nullable=False),
        sa.Column("max_rounds", sa.Integer(), nullable=False),
        sa.Column("rounds_completed", sa.Integer(), nullable=False),
        sa.Column("request_json", sa.JSON(), nullable=False),
        sa.Column("summary_json", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("campaign_jobs")
    op.drop_table("event_evaluations")
    op.drop_table("agent_sessions")
    op.drop_table("tool_call_events")
