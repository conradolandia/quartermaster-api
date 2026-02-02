"""Drop variant_name and variant_options from merchandise

Options are derived from the variation list at read time.
Revision ID: w6x7y8z9a0b1
Revises: v5w6x7y8z9a0
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa


revision = "w6x7y8z9a0b1"
down_revision = "v5w6x7y8z9a0"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("merchandise", "variant_options")
    op.drop_column("merchandise", "variant_name")


def downgrade():
    op.add_column(
        "merchandise",
        sa.Column("variant_name", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "merchandise",
        sa.Column("variant_options", sa.String(length=500), nullable=True),
    )
