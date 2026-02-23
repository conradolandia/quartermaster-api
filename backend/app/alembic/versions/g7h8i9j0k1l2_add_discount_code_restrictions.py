"""add_discount_code_restrictions

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "g7h8i9j0k1l2"
down_revision = "f6g7h8i9j0k1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "discountcode",
        sa.Column("restricted_trip_type", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "discountcode",
        sa.Column("restricted_launch_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "discountcode",
        sa.Column("restricted_mission_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "discountcode",
        sa.Column("restricted_trip_id", sa.Uuid(), nullable=True),
    )


def downgrade():
    op.drop_column("discountcode", "restricted_trip_id")
    op.drop_column("discountcode", "restricted_mission_id")
    op.drop_column("discountcode", "restricted_launch_id")
    op.drop_column("discountcode", "restricted_trip_type")
