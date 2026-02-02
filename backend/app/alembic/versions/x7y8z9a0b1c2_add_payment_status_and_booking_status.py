"""Add payment_status and booking_status to booking

Adds PaymentStatus and BookingStatusNew enums, new columns, and backfills
from existing status column. Keeps status column for rollback.
Revision ID: x7y8z9a0b1c2
Revises: w6x7y8z9a0b1
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


revision = "x7y8z9a0b1c2"
down_revision = "w6x7y8z9a0b1"
branch_labels = None
depends_on = None


def upgrade():
    # Create new enum types
    paymentstatus = sa.Enum(
        "pending_payment",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        name="paymentstatus",
        create_type=True,
    )
    paymentstatus.create(op.get_bind(), checkfirst=True)

    bookingstatusnew = sa.Enum(
        "draft",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        name="bookingstatusnew",
        create_type=True,
    )
    bookingstatusnew.create(op.get_bind(), checkfirst=True)

    # Add columns with defaults so NOT NULL works
    op.add_column(
        "booking",
        sa.Column("payment_status", sa.Enum("pending_payment", "paid", "failed", "refunded", "partially_refunded", name="paymentstatus"), nullable=True),
    )
    op.add_column(
        "booking",
        sa.Column("booking_status", sa.Enum("draft", "confirmed", "checked_in", "completed", "cancelled", name="bookingstatusnew"), nullable=False, server_default="draft"),
    )

    # Backfill from status: draft -> booking_status=draft, payment_status=NULL
    # pending_payment -> booking_status=draft, payment_status=pending_payment
    # confirmed -> booking_status=confirmed, payment_status=paid
    # checked_in -> booking_status=checked_in, payment_status=paid
    # completed -> booking_status=completed, payment_status=paid
    # cancelled -> booking_status=cancelled, payment_status=failed
    # refunded -> booking_status=cancelled, payment_status=refunded
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'draft', payment_status = NULL
            WHERE status = 'draft'
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'draft', payment_status = 'pending_payment'
            WHERE status = 'pending_payment'
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'confirmed', payment_status = 'paid'
            WHERE status = 'confirmed'
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'checked_in', payment_status = 'paid'
            WHERE status = 'checked_in'
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'completed', payment_status = 'paid'
            WHERE status = 'completed'
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'cancelled', payment_status = 'failed'
            WHERE status = 'cancelled'
        """)
    )
    conn.execute(
        sa.text("""
            UPDATE booking SET booking_status = 'cancelled', payment_status = 'refunded'
            WHERE status = 'refunded'
        """)
    )

    # Remove server default so app controls the value
    op.alter_column(
        "booking",
        "booking_status",
        server_default=None,
    )


def downgrade():
    op.drop_column("booking", "booking_status")
    op.drop_column("booking", "payment_status")
    op.execute("DROP TYPE IF EXISTS bookingstatusnew")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
