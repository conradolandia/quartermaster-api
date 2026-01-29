"""fix tripmerchandise merchandise_id if missing

One-off: run tripmerchandise refactor when merchandise table exists but
tripmerchandise still has old columns (name, description, price, quantity_available)
and no merchandise_id. Handles DBs where migration d6e7f8a9b0c1 was skipped.

Revision ID: fix_tripmerch_merch_id
Revises: fix_boat_provider_id
Create Date: 2026-01-29

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "fix_tripmerch_merch_id"
down_revision = "fix_boat_provider_id"
branch_labels = None
depends_on = None


def _tripmerchandise_has_merchandise_id(inspector) -> bool:
    if not inspector.has_table("tripmerchandise"):
        return True
    cols = [c["name"] for c in inspector.get_columns("tripmerchandise")]
    return "merchandise_id" in cols


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    if _tripmerchandise_has_merchandise_id(inspector):
        return

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

    inspector = inspect(conn)
    tm_cols = [c["name"] for c in inspector.get_columns("tripmerchandise")]
    if "quantity_available_override" not in tm_cols:
        op.add_column(
            "tripmerchandise",
            sa.Column("quantity_available_override", sa.Integer(), nullable=True),
        )
    if "price_override" not in tm_cols:
        op.add_column(
            "tripmerchandise",
            sa.Column("price_override", sa.Float(), nullable=True),
        )

    tm_cols = [c["name"] for c in inspector.get_columns("tripmerchandise")]
    for col in ("name", "description", "price", "quantity_available"):
        if col in tm_cols:
            op.drop_column("tripmerchandise", col)

    op.alter_column(
        "tripmerchandise",
        "merchandise_id",
        existing_type=sa.UUID(),
        nullable=False,
    )


def downgrade():
    pass
