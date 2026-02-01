"""Add booking.refund_reason and booking.refund_notes

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-02-01

Store refund reason and notes at booking level so they are always available
for display (partial refunds and full refunds).
"""
from alembic import op
import sqlalchemy as sa


revision = "t3u4v5w6x7y8"
down_revision = "s2t3u4v5w6x7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "booking",
        sa.Column("refund_reason", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "booking",
        sa.Column("refund_notes", sa.String(length=1000), nullable=True),
    )


def downgrade():
    op.drop_column("booking", "refund_notes")
    op.drop_column("booking", "refund_reason")
