"""merchandise catalog and trip_merchandise refactor

Add standalone Merchandise table. Refactor TripMerchandise to link trip <-> merchandise
with optional quantity_available_override and price_override.

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-01-28

"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create merchandise table
    op.create_table(
        "merchandise",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("quantity_available", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Add merchandise_id to tripmerchandise (nullable first)
    op.add_column(
        "tripmerchandise",
        sa.Column("merchandise_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_tripmerchandise_merchandise_id_merchandise",
        "tripmerchandise",
        "merchandise",
        ["merchandise_id"],
        ["id"],
    )

    # 3. Data migration: for each tripmerchandise row, create merchandise row and set merchandise_id
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT id, name, description, price, quantity_available FROM tripmerchandise"
        )
    ).fetchall()
    for row in result:
        tm_id, name, description, price, qty = row
        new_merch_id = uuid.uuid4()
        conn.execute(
            sa.text(
                """
                INSERT INTO merchandise (id, name, description, price, quantity_available, created_at, updated_at)
                VALUES (:id, :name, :description, :price, :qty, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
                """
            ),
            {
                "id": new_merch_id,
                "name": name or "",
                "description": description,
                "price": price,
                "qty": qty or 0,
            },
        )
        conn.execute(
            sa.text("UPDATE tripmerchandise SET merchandise_id = :mid WHERE id = :tid"),
            {"mid": new_merch_id, "tid": tm_id},
        )

    # 4. Add override columns
    op.add_column(
        "tripmerchandise",
        sa.Column("quantity_available_override", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tripmerchandise",
        sa.Column("price_override", sa.Float(), nullable=True),
    )

    # 5. Drop old columns from tripmerchandise
    op.drop_column("tripmerchandise", "name")
    op.drop_column("tripmerchandise", "description")
    op.drop_column("tripmerchandise", "price")
    op.drop_column("tripmerchandise", "quantity_available")

    # 6. Make merchandise_id NOT NULL
    op.alter_column(
        "tripmerchandise",
        "merchandise_id",
        existing_type=sa.UUID(),
        nullable=False,
    )


def downgrade():
    # Add back columns to tripmerchandise (nullable first)
    op.add_column(
        "tripmerchandise",
        sa.Column("name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "tripmerchandise",
        sa.Column("description", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "tripmerchandise",
        sa.Column("price", sa.Float(), nullable=True),
    )
    op.add_column(
        "tripmerchandise",
        sa.Column("quantity_available", sa.Integer(), nullable=True),
    )

    # Copy data back from merchandise (one-to-one by merchandise_id)
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT tm.id, m.name, m.description, m.price, m.quantity_available
            FROM tripmerchandise tm
            JOIN merchandise m ON tm.merchandise_id = m.id
            """
        )
    ).fetchall()
    for row in result:
        tm_id, name, description, price, qty = row
        conn.execute(
            sa.text(
                """
                UPDATE tripmerchandise SET name = :name, description = :description,
                price = :price, quantity_available = :qty WHERE id = :id
                """
            ),
            {"id": str(tm_id), "name": name, "description": description, "price": price, "qty": qty},
        )

    op.alter_column("tripmerchandise", "name", nullable=False)
    op.alter_column("tripmerchandise", "price", nullable=False)
    op.alter_column("tripmerchandise", "quantity_available", nullable=False)

    op.drop_column("tripmerchandise", "quantity_available_override")
    op.drop_column("tripmerchandise", "price_override")
    op.drop_constraint(
        "fk_tripmerchandise_merchandise_id_merchandise",
        "tripmerchandise",
        type_="foreignkey",
    )
    op.drop_column("tripmerchandise", "merchandise_id")
    op.drop_table("merchandise")
