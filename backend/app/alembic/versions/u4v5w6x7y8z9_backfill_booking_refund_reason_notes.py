"""Backfill booking.refund_reason and refund_notes from bookingitem

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-02-01

For existing refunded bookings where booking.refund_reason is still NULL,
copy refund_reason and refund_notes from the first bookingitem that has them
(so data stored only on items is available at booking level for display).
"""
from alembic import op


revision = "u4v5w6x7y8z9"
down_revision = "t3u4v5w6x7y8"
branch_labels = None
depends_on = None


def upgrade():
    # For each booking with refunded_amount_cents > 0 and no booking-level reason yet,
    # copy reason/notes from the first item (by created_at) that has them.
    op.execute(
        """
        UPDATE booking b
        SET
            refund_reason = COALESCE(sub.refund_reason, b.refund_reason),
            refund_notes = COALESCE(sub.refund_notes, b.refund_notes)
        FROM (
            SELECT DISTINCT ON (bi.booking_id)
                bi.booking_id,
                bi.refund_reason,
                bi.refund_notes
            FROM bookingitem bi
            INNER JOIN booking bk ON bk.id = bi.booking_id
            WHERE bk.refunded_amount_cents > 0
              AND (bk.refund_reason IS NULL OR bk.refund_reason = '')
              AND (
                  (bi.refund_reason IS NOT NULL AND TRIM(bi.refund_reason) != '')
                  OR (bi.refund_notes IS NOT NULL AND TRIM(bi.refund_notes) != '')
              )
            ORDER BY bi.booking_id, bi.created_at
        ) sub
        WHERE b.id = sub.booking_id
        """
    )


def downgrade():
    # Data backfill is not reversed; booking-level columns keep their values.
    pass
