"""Move booking_mode from mission to trip

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-02-01

Booking mode (private, early_bird, public) is now per-trip instead of per-mission.
"""
from alembic import op
import sqlalchemy as sa


revision = "s2t3u4v5w6x7"
down_revision = "r1s2t3u4v5w6"
branch_labels = None
depends_on = None


def upgrade():
    # Add booking_mode to trip table (default private)
    op.add_column(
        "trip",
        sa.Column("booking_mode", sa.String(length=20), nullable=False, server_default="private"),
    )
    # Copy mission.booking_mode to trip.booking_mode for existing trips
    op.execute(
        """
        UPDATE trip
        SET booking_mode = mission.booking_mode
        FROM mission
        WHERE trip.mission_id = mission.id
        """
    )
    # Remove booking_mode from mission table
    op.drop_column("mission", "booking_mode")


def downgrade():
    # Add booking_mode back to mission table
    op.add_column(
        "mission",
        sa.Column("booking_mode", sa.String(length=20), nullable=False, server_default="private"),
    )
    # Copy trip.booking_mode back to mission (use first trip's mode per mission)
    op.execute(
        """
        UPDATE mission
        SET booking_mode = sub.booking_mode
        FROM (
            SELECT DISTINCT ON (mission_id) mission_id, booking_mode
            FROM trip
            ORDER BY mission_id, check_in_time DESC
        ) AS sub
        WHERE mission.id = sub.mission_id
        """
    )
    op.drop_column("trip", "booking_mode")
