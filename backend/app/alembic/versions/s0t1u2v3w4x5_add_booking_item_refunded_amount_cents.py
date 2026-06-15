"""Add bookingitem.refunded_amount_cents for line-item refunds

Revision ID: s0t1u2v3w4x5
Revises: r9s0t1u2v3w4
Create Date: 2026-06-14

Tracks per-line-item refund amount (discounted subtotal + proportional tax).
"""
from alembic import op
import sqlalchemy as sa


revision = "s0t1u2v3w4x5"
down_revision = "r9s0t1u2v3w4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "bookingitem",
        sa.Column(
            "refunded_amount_cents",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade():
    op.drop_column("bookingitem", "refunded_amount_cents")
