"""move_sales_open_from_mission_to_trip

Move sales_open_at from mission to trip. Trip is not bookable until sales_open_at.
Backfill trip.sales_open_at from mission.sales_open_at, then drop mission.sales_open_at.

Revision ID: z9a0b1c2d3e4
Revises: y8z9a0b1c2d3
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


revision = "z9a0b1c2d3e4"
down_revision = "y8z9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "trip",
        sa.Column(
            "sales_open_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE trip t
        SET sales_open_at = m.sales_open_at
        FROM mission m
        WHERE t.mission_id = m.id AND m.sales_open_at IS NOT NULL
        """
    )
    op.drop_column("mission", "sales_open_at")


def downgrade() -> None:
    op.add_column(
        "mission",
        sa.Column(
            "sales_open_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE mission m
        SET sales_open_at = (
            SELECT t.sales_open_at
            FROM trip t
            WHERE t.mission_id = m.id AND t.sales_open_at IS NOT NULL
            ORDER BY t.departure_time ASC
            LIMIT 1
        )
        """
    )
    op.drop_column("trip", "sales_open_at")
