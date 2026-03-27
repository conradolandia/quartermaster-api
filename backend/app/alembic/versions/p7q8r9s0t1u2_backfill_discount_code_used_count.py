"""Backfill discountcode.used_count from confirmed bookings.

Revision ID: p7q8r9s0t1u2
Revises: n4o5p6q7r8s9
Create Date: 2026-03-26

"""

from alembic import op


revision = "p7q8r9s0t1u2"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE discountcode AS dc
        SET used_count = COALESCE(sub.cnt, 0)
        FROM (
            SELECT discount_code_id AS id, COUNT(*)::integer AS cnt
            FROM booking
            WHERE discount_code_id IS NOT NULL
              AND booking_status IN ('confirmed', 'checked_in', 'completed')
            GROUP BY discount_code_id
        ) AS sub
        WHERE dc.id = sub.id
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE discountcode
        SET used_count = 0
        """
    )
