"""Increase bookingitem.item_type from 32 to 255 chars

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-02-21

BookingItem.item_type stores ticket_type (short) or merchandise name (up to 255).
Merchandise names were causing validation errors when > 32 chars.
"""
from alembic import op
import sqlalchemy as sa


revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "bookingitem",
        "item_type",
        existing_type=sa.String(length=32),
        type_=sa.String(length=255),
        existing_nullable=False,
    )


def downgrade():
    op.alter_column(
        "bookingitem",
        "item_type",
        existing_type=sa.String(length=255),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
