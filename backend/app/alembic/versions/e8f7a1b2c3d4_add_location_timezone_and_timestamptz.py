"""add_location_timezone_and_timestamptz

Add timezone to location (events use location's timezone).
Convert all datetime columns to TIMESTAMP WITH TIME ZONE; existing naive
values are interpreted as UTC.

Revision ID: e8f7a1b2c3d4
Revises: b7e8f9a0c1d2
Create Date: 2026-01-28

"""
from alembic import op
import sqlalchemy as sa


revision = "e8f7a1b2c3d4"
down_revision = "b7e8f9a0c1d2"
branch_labels = None
depends_on = None


def _alter_datetime_to_timestamptz(table: str, column: str) -> None:
    op.alter_column(
        table,
        column,
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        postgresql_using=f'"{column}" AT TIME ZONE \'UTC\'',
    )


def upgrade() -> None:
    # Add timezone to location (IANA name, e.g. America/New_York)
    op.add_column(
        "location",
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
    )

    # location
    _alter_datetime_to_timestamptz("location", "created_at")
    _alter_datetime_to_timestamptz("location", "updated_at")

    # jurisdiction
    _alter_datetime_to_timestamptz("jurisdiction", "created_at")
    _alter_datetime_to_timestamptz("jurisdiction", "updated_at")

    # launch
    _alter_datetime_to_timestamptz("launch", "launch_timestamp")
    _alter_datetime_to_timestamptz("launch", "created_at")
    _alter_datetime_to_timestamptz("launch", "updated_at")

    # mission
    _alter_datetime_to_timestamptz("mission", "sales_open_at")
    _alter_datetime_to_timestamptz("mission", "created_at")
    _alter_datetime_to_timestamptz("mission", "updated_at")

    # trip
    _alter_datetime_to_timestamptz("trip", "check_in_time")
    _alter_datetime_to_timestamptz("trip", "boarding_time")
    _alter_datetime_to_timestamptz("trip", "departure_time")
    _alter_datetime_to_timestamptz("trip", "created_at")
    _alter_datetime_to_timestamptz("trip", "updated_at")

    # tripboat
    _alter_datetime_to_timestamptz("tripboat", "created_at")
    _alter_datetime_to_timestamptz("tripboat", "updated_at")

    # trippricing
    _alter_datetime_to_timestamptz("trippricing", "created_at")
    _alter_datetime_to_timestamptz("trippricing", "updated_at")

    # tripmerchandise
    _alter_datetime_to_timestamptz("tripmerchandise", "created_at")
    _alter_datetime_to_timestamptz("tripmerchandise", "updated_at")

    # boat
    _alter_datetime_to_timestamptz("boat", "created_at")
    _alter_datetime_to_timestamptz("boat", "updated_at")

    # booking
    _alter_datetime_to_timestamptz("booking", "created_at")
    _alter_datetime_to_timestamptz("booking", "updated_at")

    # bookingitem
    _alter_datetime_to_timestamptz("bookingitem", "created_at")
    _alter_datetime_to_timestamptz("bookingitem", "updated_at")

    # discountcode
    _alter_datetime_to_timestamptz("discountcode", "valid_from")
    _alter_datetime_to_timestamptz("discountcode", "valid_until")
    _alter_datetime_to_timestamptz("discountcode", "created_at")
    _alter_datetime_to_timestamptz("discountcode", "updated_at")

    # provider: already TIMESTAMP WITH TIME ZONE (created in 99839ca7089e), skip


def _alter_timestamptz_to_datetime(table: str, column: str) -> None:
    op.alter_column(
        table,
        column,
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(),
        postgresql_using=f'"{column}" AT TIME ZONE \'UTC\'',
    )


def downgrade() -> None:
    # discountcode
    _alter_timestamptz_to_datetime("discountcode", "valid_from")
    _alter_timestamptz_to_datetime("discountcode", "valid_until")
    _alter_timestamptz_to_datetime("discountcode", "created_at")
    _alter_timestamptz_to_datetime("discountcode", "updated_at")

    # bookingitem
    _alter_timestamptz_to_datetime("bookingitem", "created_at")
    _alter_timestamptz_to_datetime("bookingitem", "updated_at")

    # booking
    _alter_timestamptz_to_datetime("booking", "created_at")
    _alter_timestamptz_to_datetime("booking", "updated_at")

    # boat
    _alter_timestamptz_to_datetime("boat", "created_at")
    _alter_timestamptz_to_datetime("boat", "updated_at")

    # tripmerchandise
    _alter_timestamptz_to_datetime("tripmerchandise", "created_at")
    _alter_timestamptz_to_datetime("tripmerchandise", "updated_at")

    # trippricing
    _alter_timestamptz_to_datetime("trippricing", "created_at")
    _alter_timestamptz_to_datetime("trippricing", "updated_at")

    # tripboat
    _alter_timestamptz_to_datetime("tripboat", "created_at")
    _alter_timestamptz_to_datetime("tripboat", "updated_at")

    # trip
    _alter_timestamptz_to_datetime("trip", "check_in_time")
    _alter_timestamptz_to_datetime("trip", "boarding_time")
    _alter_timestamptz_to_datetime("trip", "departure_time")
    _alter_timestamptz_to_datetime("trip", "created_at")
    _alter_timestamptz_to_datetime("trip", "updated_at")

    # mission
    _alter_timestamptz_to_datetime("mission", "sales_open_at")
    _alter_timestamptz_to_datetime("mission", "created_at")
    _alter_timestamptz_to_datetime("mission", "updated_at")

    # launch
    _alter_timestamptz_to_datetime("launch", "launch_timestamp")
    _alter_timestamptz_to_datetime("launch", "created_at")
    _alter_timestamptz_to_datetime("launch", "updated_at")

    # jurisdiction
    _alter_timestamptz_to_datetime("jurisdiction", "created_at")
    _alter_timestamptz_to_datetime("jurisdiction", "updated_at")

    # location
    _alter_timestamptz_to_datetime("location", "created_at")
    _alter_timestamptz_to_datetime("location", "updated_at")

    op.drop_column("location", "timezone")
