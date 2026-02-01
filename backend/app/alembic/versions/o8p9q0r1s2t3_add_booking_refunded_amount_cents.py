"""Add booking.refunded_amount_cents for partial refunds

Revision ID: o8p9q0r1s2t3
Revises: i2j3k4l5m6n7
Create Date: 2026-02-01

Tracks cumulative refund amount so partial refunds keep status confirmed/checked_in/completed
and more refunds can be processed until fully refunded.
"""
from alembic import op
import sqlalchemy as sa


revision = "o8p9q0r1s2t3"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "booking",
        sa.Column("refunded_amount_cents", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("booking", "refunded_amount_cents")
