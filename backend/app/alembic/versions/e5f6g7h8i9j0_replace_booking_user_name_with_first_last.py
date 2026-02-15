"""Replace booking.user_name with first_name and last_name

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-02-14

Splits user_name on first space: first word -> first_name, rest -> last_name.
"""
from alembic import op
import sqlalchemy as sa


revision = "e5f6g7h8i9j0"
down_revision = "d4e5f6g7h8i9"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add new columns (nullable initially)
    op.add_column("booking", sa.Column("first_name", sa.String(length=128), nullable=True))
    op.add_column("booking", sa.Column("last_name", sa.String(length=128), nullable=True))

    # 2. Backfill: split user_name on first space (first word -> first_name, rest -> last_name)
    # substring(str, '^\S+') = first word; substring(str, '^\S+\s+(.*)') = rest (NULL if single word)
    op.execute("""
        UPDATE booking
        SET
            first_name = LEFT(COALESCE(SUBSTRING(TRIM(COALESCE(user_name, '')), '^\\S+'), ''), 128),
            last_name = LEFT(COALESCE(SUBSTRING(TRIM(COALESCE(user_name, '')), '^\\S+\\s+(.*)'), ''), 128)
    """)

    # 3. Drop user_name
    op.drop_column("booking", "user_name")

    # 4. Make columns NOT NULL
    op.alter_column(
        "booking",
        "first_name",
        existing_type=sa.String(length=128),
        nullable=False,
    )
    op.alter_column(
        "booking",
        "last_name",
        existing_type=sa.String(length=128),
        nullable=False,
    )


def downgrade():
    # Add user_name back
    op.add_column("booking", sa.Column("user_name", sa.String(length=255), nullable=True))

    # Reconstruct user_name from first_name + last_name
    op.execute("""
        UPDATE booking
        SET user_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
    """)

    op.alter_column("booking", "user_name", nullable=False)
    op.drop_column("booking", "first_name")
    op.drop_column("booking", "last_name")
