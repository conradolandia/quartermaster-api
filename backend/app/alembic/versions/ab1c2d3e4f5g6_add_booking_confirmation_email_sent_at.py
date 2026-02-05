"""Add booking.confirmation_email_sent_at

Revision ID: ab1c2d3e4f5g6
Revises: aa0b1c2d3e4f5
Create Date: 2026-02-05

Track when the booking confirmation email was sent to prevent duplicate emails
from race conditions between the verify-payment endpoint and Stripe webhook.
"""
from alembic import op
import sqlalchemy as sa


revision = "ab1c2d3e4f5g6"
down_revision = "aa0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "booking",
        sa.Column("confirmation_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("booking", "confirmation_email_sent_at")
