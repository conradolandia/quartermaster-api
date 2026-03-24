"""Make boatpricing.capacity nullable for shared-boat ticket types.

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-03-23

"""

from alembic import op
import sqlalchemy as sa


revision = "n4o5p6q7r8s9"
down_revision = "m3n4o5p6q7r8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "boatpricing",
        "capacity",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "boatpricing",
        "capacity",
        existing_type=sa.Integer(),
        nullable=False,
    )
