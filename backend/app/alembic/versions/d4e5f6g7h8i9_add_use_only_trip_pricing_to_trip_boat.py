"""Add tripboat.use_only_trip_pricing

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-14

When True, effective pricing for this trip/boat uses only TripBoatPricing;
boat defaults (BoatPricing) are ignored.
"""
from alembic import op
import sqlalchemy as sa


revision = "d4e5f6g7h8i9"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tripboat",
        sa.Column("use_only_trip_pricing", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("tripboat", "use_only_trip_pricing")
