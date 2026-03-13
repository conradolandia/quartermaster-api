"""Add BookingItemStatus enum value 'cancelled'

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-03-12

When a booking is cancelled (without refund), items are set to cancelled
instead of active so the item status reflects the booking state.
"""
from alembic import op


revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE bookingitemstatus ADD VALUE IF NOT EXISTS 'cancelled'"
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass
