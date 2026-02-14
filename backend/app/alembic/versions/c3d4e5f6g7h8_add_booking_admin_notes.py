"""Add booking.admin_notes

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-02-14

Admin-only notes for bookings, not exposed to public API.
"""
from alembic import op
import sqlalchemy as sa


revision = "c3d4e5f6g7h8"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "booking",
        sa.Column("admin_notes", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("booking", "admin_notes")
