"""Boat pricing and trip boat pricing (ticket types per boat, overrides per trip)

Replaces TripPricing with:
- BoatPricing: boat-level default ticket types and prices
- TripBoatPricing: per-trip, per-boat price overrides

Revision ID: h1i2j3k4l5m6
Revises: m5n6o7p8q9r0
Create Date: 2026-01-30

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = "h1i2j3k4l5m6"
down_revision = "m5n6o7p8q9r0"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create boatpricing table
    op.create_table(
        "boatpricing",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("boat_id", sa.UUID(), nullable=False),
        sa.Column("ticket_type", sa.String(length=32), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["boat_id"], ["boat.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_boatpricing_boat_id", "boatpricing", ["boat_id"], unique=False
    )
    op.create_index(
        "ix_boatpricing_boat_id_ticket_type",
        "boatpricing",
        ["boat_id", "ticket_type"],
        unique=True,
    )

    # 2. Create tripboatpricing table
    op.create_table(
        "tripboatpricing",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_boat_id", sa.UUID(), nullable=False),
        sa.Column("ticket_type", sa.String(length=32), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["trip_boat_id"], ["tripboat.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_tripboatpricing_trip_boat_id",
        "tripboatpricing",
        ["trip_boat_id"],
        unique=False,
    )
    op.create_index(
        "ix_tripboatpricing_trip_boat_id_ticket_type",
        "tripboatpricing",
        ["trip_boat_id", "ticket_type"],
        unique=True,
    )

    # 3. Data migration: copy trippricing -> tripboatpricing (per trip_boat)
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("""
            SELECT tb.id AS trip_boat_id, tp.ticket_type, tp.price,
                   tp.created_at, tp.updated_at
            FROM trippricing tp
            JOIN tripboat tb ON tb.trip_id = tp.trip_id
        """)
    ).fetchall()
    for row in rows:
        conn.execute(
            sa.text("""
                INSERT INTO tripboatpricing (id, trip_boat_id, ticket_type, price, created_at, updated_at)
                VALUES (:id, :trip_boat_id, :ticket_type, :price, :created_at, :updated_at)
            """),
            {
                "id": uuid.uuid4(),
                "trip_boat_id": row.trip_boat_id,
                "ticket_type": row.ticket_type,
                "price": row.price,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            },
        )

    # 4. Populate boatpricing from first trip_boat per boat (so boat has defaults)
    boat_rows = conn.execute(
        sa.text("""
            SELECT DISTINCT ON (tb.boat_id, tbp.ticket_type)
                   tb.boat_id, tbp.ticket_type, tbp.price,
                   tbp.created_at, tbp.updated_at
            FROM tripboatpricing tbp
            JOIN tripboat tb ON tb.id = tbp.trip_boat_id
            ORDER BY tb.boat_id, tbp.ticket_type, tbp.created_at
        """)
    ).fetchall()
    for row in boat_rows:
        conn.execute(
            sa.text("""
                INSERT INTO boatpricing (id, boat_id, ticket_type, price, created_at, updated_at)
                VALUES (:id, :boat_id, :ticket_type, :price, :created_at, :updated_at)
            """),
            {
                "id": uuid.uuid4(),
                "boat_id": row.boat_id,
                "ticket_type": row.ticket_type,
                "price": row.price,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            },
        )

    # 5. Drop trippricing
    op.drop_table("trippricing")


def downgrade():
    # Recreate trippricing (schema from existing migrations: trip_id, ticket_type, price, id, created_at, updated_at)
    op.create_table(
        "trippricing",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("ticket_type", sa.String(length=32), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["trip_id"], ["trip.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_trippricing_trip_id", "trippricing", ["trip_id"], unique=False
    )

    # Migrate back: one row per (trip_id, ticket_type) from any trip_boat of that trip
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("""
            SELECT DISTINCT ON (tb.trip_id, tbp.ticket_type)
                   tb.trip_id, tbp.ticket_type, tbp.price,
                   tbp.created_at, tbp.updated_at
            FROM tripboatpricing tbp
            JOIN tripboat tb ON tb.id = tbp.trip_boat_id
            ORDER BY tb.trip_id, tbp.ticket_type, tbp.created_at
        """)
    ).fetchall()
    for row in rows:
        conn.execute(
            sa.text("""
                INSERT INTO trippricing (id, trip_id, ticket_type, price, created_at, updated_at)
                VALUES (:id, :trip_id, :ticket_type, :price, :created_at, :updated_at)
            """),
            {
                "id": uuid.uuid4(),
                "trip_id": row.trip_id,
                "ticket_type": row.ticket_type,
                "price": row.price,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            },
        )

    op.drop_table("tripboatpricing")
    op.drop_table("boatpricing")
