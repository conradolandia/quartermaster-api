"""Replace user.is_superuser with user.role (admin | staff)

Revision ID: r9s0t1u2v3w4
Revises: q8r9s0t1u2v3
Create Date: 2026-06-14

"""

import sqlalchemy as sa
from alembic import op

revision = "r9s0t1u2v3w4"
down_revision = "q8r9s0t1u2v3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("role", sa.String(length=16), nullable=True),
    )
    op.execute("UPDATE \"user\" SET role = 'admin' WHERE is_superuser = true")
    op.execute(
        "UPDATE \"user\" SET role = 'staff' WHERE is_superuser = false OR role IS NULL"
    )
    op.alter_column("user", "role", nullable=False)
    op.drop_column("user", "is_superuser")


def downgrade() -> None:
    op.add_column(
        "user",
        sa.Column("is_superuser", sa.Boolean(), nullable=True),
    )
    op.execute("UPDATE \"user\" SET is_superuser = true WHERE role = 'admin'")
    op.execute(
        "UPDATE \"user\" SET is_superuser = false WHERE role = 'staff' OR is_superuser IS NULL"
    )
    op.alter_column("user", "is_superuser", nullable=False)
    op.drop_column("user", "role")
