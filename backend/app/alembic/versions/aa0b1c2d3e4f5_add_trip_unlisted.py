"""add_trip_unlisted

Add unlisted column to trip. Unlisted trips are excluded from public listing
but still accessible via direct link (GET /trips/public/{trip_id}).

Revision ID: aa0b1c2d3e4f5
Revises: z9a0b1c2d3e4
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa


revision = "aa0b1c2d3e4f5"
down_revision = "z9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "trip",
        sa.Column("unlisted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("trip", "unlisted")
