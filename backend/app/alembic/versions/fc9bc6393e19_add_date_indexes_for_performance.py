"""add_date_indexes_for_performance

Revision ID: fc9bc6393e19
Revises: a1b2c3d4e5f6
Create Date: 2026-01-26 23:35:02.641023

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'fc9bc6393e19'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Add index on launch.launch_timestamp for filtering past launches
    op.create_index(
        'idx_launch_timestamp',
        'launch',
        ['launch_timestamp'],
        unique=False
    )

    # Add index on trip.departure_time for filtering past trips
    op.create_index(
        'idx_trip_departure_time',
        'trip',
        ['departure_time'],
        unique=False
    )

    # Add index on mission.launch_id for joining with launches
    # Note: This might already exist as a foreign key index, but we'll add it explicitly
    # If it already exists, this will fail and can be handled
    try:
        op.create_index(
            'idx_mission_launch_id',
            'mission',
            ['launch_id'],
            unique=False
        )
    except Exception:
        # Index might already exist, which is fine
        pass


def downgrade():
    # Drop indexes (ignore if they don't exist)
    try:
        op.drop_index('idx_mission_launch_id', table_name='mission')
    except Exception:
        pass
    try:
        op.drop_index('idx_trip_departure_time', table_name='trip')
    except Exception:
        pass
    try:
        op.drop_index('idx_launch_timestamp', table_name='launch')
    except Exception:
        pass
