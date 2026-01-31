"""Add capacity to boat pricing and trip boat pricing

- BoatPricing: capacity (required) = max seats per ticket type on the boat
- TripBoatPricing: capacity (nullable) = per-trip override for that ticket type

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-01-31

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add capacity to boatpricing (NOT NULL after backfill)
    op.add_column(
        "boatpricing",
        sa.Column("capacity", sa.Integer(), nullable=True),
    )
    # Backfill: for each boat, split boat.capacity across its BoatPricing rows
    conn = op.get_bind()
    boats = conn.execute(
        sa.text("SELECT id, capacity FROM boat")
    ).fetchall()
    for (boat_id, boat_cap) in boats:
        rows = conn.execute(
            sa.text("SELECT id FROM boatpricing WHERE boat_id = :boat_id ORDER BY id"),
            {"boat_id": boat_id},
        ).fetchall()
        n = len(rows)
        if n == 0:
            continue
        per = boat_cap // n
        rem = boat_cap % n
        for i, (row_id,) in enumerate(rows):
            cap = per + (1 if i < rem else 0)
            conn.execute(
                sa.text("UPDATE boatpricing SET capacity = :cap WHERE id = :id"),
                {"cap": cap, "id": row_id},
            )
    op.alter_column(
        "boatpricing",
        "capacity",
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )

    # 2. Add capacity to tripboatpricing (nullable override)
    op.add_column(
        "tripboatpricing",
        sa.Column("capacity", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column("tripboatpricing", "capacity")
    op.drop_column("boatpricing", "capacity")
