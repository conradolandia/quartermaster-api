"""add merchandise variants and booking_item variant_option

Revision ID: r1s2t3u4v5w6
Revises: o8p9q0r1s2t3
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


revision = "r1s2t3u4v5w6"
down_revision = "o8p9q0r1s2t3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "merchandise",
        sa.Column("variant_name", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "merchandise",
        sa.Column("variant_options", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "bookingitem",
        sa.Column("variant_option", sa.String(length=64), nullable=True),
    )


def downgrade():
    op.drop_column("bookingitem", "variant_option")
    op.drop_column("merchandise", "variant_options")
    op.drop_column("merchandise", "variant_name")
