"""Local email/password user accounts.

Passwords stored as PBKDF2-HMAC-SHA256 digests (see src.utils.passwords) —
never plaintext. The first registered user becomes the admin (bootstrap);
further registrations require an admin API key.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_users"
down_revision: Union[str, None] = "003_custom_integrations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("display_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="admin"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
