"""Add booking.capacity_hold_expires_at for short-lived payment holds.

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa


revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking",
        sa.Column(
            "capacity_hold_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("booking", "capacity_hold_expires_at")
