"""Add tripboat.sales_enabled

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-03-09

When False, new bookings on this boat are blocked; existing reservations are kept.
"""
from alembic import op
import sqlalchemy as sa


revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tripboat",
        sa.Column("sales_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade():
    op.drop_column("tripboat", "sales_enabled")
