"""Drop legacy booking.status column and bookingstatus enum

Removes deprecated status column and PostgreSQL type bookingstatus.
Booking lifecycle is now represented by booking_status + payment_status.
Revision ID: y8z9a0b1c2d3
Revises: x7y8z9a0b1c2
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


revision = "y8z9a0b1c2d3"
down_revision = "x7y8z9a0b1c2"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("booking", "status")
    op.execute("DROP TYPE IF EXISTS bookingstatus")


def downgrade():
    op.execute(
        "CREATE TYPE bookingstatus AS ENUM ("
        "'draft', 'pending_payment', 'confirmed', 'checked_in', "
        "'completed', 'cancelled', 'refunded')"
    )
    op.add_column(
        "booking",
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "pending_payment",
                "confirmed",
                "checked_in",
                "completed",
                "cancelled",
                "refunded",
                name="bookingstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="draft",
        ),
    )
