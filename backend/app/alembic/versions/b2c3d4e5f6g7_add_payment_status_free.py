"""Add paymentstatus enum value 'free' for zero-total bookings

Revision ID: b2c3d4e5f6g7
Revises: ab1c2d3e4f5g6
Create Date: 2026-02-09

Used by confirm-free-booking so free bookings are not displayed as refunded.
"""
from alembic import op


revision = "b2c3d4e5f6g7"
down_revision = "ab1c2d3e4f5g6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS 'free'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; would require
    # recreating the type and column. No-op.
    pass
