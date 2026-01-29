"""add_trip_name

Revision ID: c5d6e7f8a9b0
Revises: e8f7a1b2c3d4
Create Date: 2026-01-28

"""
from alembic import op
import sqlalchemy as sa


revision = "c5d6e7f8a9b0"
down_revision = "e8f7a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "trip",
        sa.Column("name", sa.String(length=255), nullable=True),
    )


def downgrade():
    op.drop_column("trip", "name")
