"""User profile fields.

Widens the avatar column to Text (storing uploaded image paths) and adds
optional phone / location / organization columns so the profile page can
persist contact and team details alongside display_name.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_profile_fields"
down_revision: Union[str, None] = "005_avatar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
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
    op.alter_column(
        "users",
        "avatar",
        type_=sa.String(16),
        existing_type=sa.Text(),
        nullable=True,
    )
