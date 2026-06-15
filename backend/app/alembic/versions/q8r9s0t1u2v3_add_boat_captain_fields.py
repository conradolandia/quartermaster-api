"""Add boat.captain and tripboat.captain_override

Revision ID: q8r9s0t1u2v3
Revises: p7q8r9s0t1u2
Create Date: 2026-06-15

Optional captain name on boats, with per-trip override on trip_boat.
"""

import sqlalchemy as sa
from alembic import op

revision = "q8r9s0t1u2v3"
down_revision = "p7q8r9s0t1u2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("boat", sa.Column("captain", sa.String(length=255), nullable=True))
    op.add_column(
        "tripboat",
        sa.Column("captain_override", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tripboat", "captain_override")
    op.drop_column("boat", "captain")
