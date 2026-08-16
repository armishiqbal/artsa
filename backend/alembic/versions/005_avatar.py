"""User profile avatar.

Adds an optional avatar (emoji / preset token) column to the users table so
the profile page can persist a chosen avatar alongside display_name.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_avatar"
down_revision: Union[str, None] = "004_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar")
