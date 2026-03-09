"""add_launch_mission_archived

Add archived column to launch and mission. Archived launches/missions are
excluded from default lists. Archiving a launch archives its missions;
archiving a mission archives its trips (cascade in application layer).

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-03-08

"""
from alembic import op
import sqlalchemy as sa


revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "launch",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "mission",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("mission", "archived")
    op.drop_column("launch", "archived")
