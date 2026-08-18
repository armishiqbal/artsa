"""User profile fields.

Widens the avatar column to Text (storing uploaded image paths) and adds
optional phone / location / organization columns so the profile page can
persist contact and team details alongside display_name.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "006_profile_fields"
down_revision: str | None = "005_avatar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # batch_alter_table emits a plain ALTER on Postgres and a table-recreate on
    # SQLite, where op.alter_column would fail with "near ALTER: syntax error".
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "avatar",
            type_=sa.Text(),
            existing_type=sa.String(16),
            nullable=True,
        )
    for col in ("phone", "location", "organization"):
        op.add_column("users", sa.Column(col, sa.String(255), nullable=True))


def downgrade() -> None:
    for col in ("phone", "location", "organization"):
        op.drop_column("users", col)
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "avatar",
            type_=sa.String(16),
            existing_type=sa.Text(),
            nullable=True,
        )
