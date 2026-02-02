"""Merchandise variations table and booking_item.merchandise_variation_id

Revision ID: v5w6x7y8z9a0
Revises: u4v5w6x7y8z9
Create Date: 2026-02-01

Add MerchandiseVariation (per-variant total/sold/fulfilled). Backfill one row
per variant_options value; set quantity_sold/quantity_fulfilled from BookingItem
aggregates; set quantity_total from merchandise.quantity_available + sold.
Add merchandise_variation_id to bookingitem and backfill from variant_option.
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v5w6x7y8z9a0"
down_revision = "u4v5w6x7y8z9"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create merchandisevariation table
    op.create_table(
        "merchandisevariation",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("merchandise_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_value", sa.String(length=128), nullable=False),
        sa.Column("quantity_total", sa.Integer(), nullable=False),
        sa.Column("quantity_sold", sa.Integer(), nullable=False),
        sa.Column("quantity_fulfilled", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["merchandise_id"],
            ["merchandise.id"],
        ),
        sa.UniqueConstraint(
            "merchandise_id",
            "variant_value",
            name="uq_merchandisevariation_merchandise_variant",
        ),
    )

    # 2. Add merchandise_variation_id to bookingitem (nullable)
    op.add_column(
        "bookingitem",
        sa.Column(
            "merchandise_variation_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_bookingitem_merchandise_variation_id_merchandisevariation",
        "bookingitem",
        "merchandisevariation",
        ["merchandise_variation_id"],
        ["id"],
    )

    # 3. Backfill: create variation rows and set bookingitem.merchandise_variation_id
    conn = op.get_bind()

    # 3a. For each merchandise, create variation rows
    merch_rows = conn.execute(
        sa.text(
            "SELECT id, variant_options, quantity_available FROM merchandise"
        )
    ).fetchall()

    for merch_id, variant_options, qty_available in merch_rows:
        options = []
        if variant_options and str(variant_options).strip():
            options = [o.strip() for o in str(variant_options).split(",") if o.strip()]
        if not options:
            options = [None]  # single "no variant" row

        for variant_value in options:
            # Get quantity_sold and quantity_fulfilled for this (trip_merchandise -> merchandise + variant_option)
            # BookingItem has trip_merchandise_id, variant_option; we need to aggregate by merchandise + variant_option
            # So: join bookingitem -> tripmerchandise on trip_merchandise_id, where tripmerchandise.merchandise_id = merch_id
            # and (variant_option = variant_value OR (variant_value is NULL and variant_option is NULL))
            if variant_value is None:
                sold_result = conn.execute(
                    sa.text("""
                        SELECT COALESCE(SUM(bi.quantity), 0)
                        FROM bookingitem bi
                        INNER JOIN tripmerchandise tm ON tm.id = bi.trip_merchandise_id
                        WHERE tm.merchandise_id = :merch_id
                          AND (bi.variant_option IS NULL OR TRIM(bi.variant_option) = '')
                    """),
                    {"merch_id": str(merch_id)},
                ).scalar()
                fulfilled_result = conn.execute(
                    sa.text("""
                        SELECT COALESCE(SUM(bi.quantity), 0)
                        FROM bookingitem bi
                        INNER JOIN tripmerchandise tm ON tm.id = bi.trip_merchandise_id
                        WHERE tm.merchandise_id = :merch_id
                          AND (bi.variant_option IS NULL OR TRIM(bi.variant_option) = '')
                          AND bi.status = 'fulfilled'
                    """),
                    {"merch_id": str(merch_id)},
                ).scalar()
            else:
                sold_result = conn.execute(
                    sa.text("""
                        SELECT COALESCE(SUM(bi.quantity), 0)
                        FROM bookingitem bi
                        INNER JOIN tripmerchandise tm ON tm.id = bi.trip_merchandise_id
                        WHERE tm.merchandise_id = :merch_id AND bi.variant_option = :v
                    """),
                    {"merch_id": str(merch_id), "v": variant_value},
                ).scalar()
                fulfilled_result = conn.execute(
                    sa.text("""
                        SELECT COALESCE(SUM(bi.quantity), 0)
                        FROM bookingitem bi
                        INNER JOIN tripmerchandise tm ON tm.id = bi.trip_merchandise_id
                        WHERE tm.merchandise_id = :merch_id AND bi.variant_option = :v
                          AND bi.status = 'fulfilled'
                    """),
                    {"merch_id": str(merch_id), "v": variant_value},
                ).scalar()

            quantity_sold = sold_result or 0
            quantity_fulfilled = fulfilled_result or 0
            # quantity_total: if only one variation, use qty_available + quantity_sold; else split heuristically
            if len(options) == 1 and options[0] is None:
                quantity_total = (qty_available or 0) + quantity_sold
            elif len(options) == 1:
                quantity_total = (qty_available or 0) + quantity_sold
            else:
                # Multiple variants: give each at least quantity_sold, remainder from available split
                quantity_total = quantity_sold + max(
                    0,
                    ((qty_available or 0) // len(options)),
                )

            var_id = uuid.uuid4()
            conn.execute(
                sa.text("""
                    INSERT INTO merchandisevariation
                    (id, merchandise_id, variant_value, quantity_total, quantity_sold, quantity_fulfilled, created_at, updated_at)
                    VALUES (:id, :merchandise_id, :variant_value, :quantity_total, :quantity_sold, :quantity_fulfilled,
                            NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
                """),
                {
                    "id": var_id,
                    "merchandise_id": merch_id,
                    "variant_value": variant_value if variant_value is not None else "",
                    "quantity_total": quantity_total,
                    "quantity_sold": quantity_sold,
                    "quantity_fulfilled": quantity_fulfilled,
                },
            )

            # 3b. Set bookingitem.merchandise_variation_id where trip_merchandise.merchandise_id and variant_option match
            if variant_value is None:
                conn.execute(
                    sa.text("""
                        UPDATE bookingitem bi
                        SET merchandise_variation_id = :var_id
                        FROM tripmerchandise tm
                        WHERE bi.trip_merchandise_id = tm.id
                          AND tm.merchandise_id = :merch_id
                          AND (bi.variant_option IS NULL OR TRIM(bi.variant_option) = '')
                    """),
                    {"var_id": var_id, "merch_id": merch_id},
                )
            else:
                conn.execute(
                    sa.text("""
                        UPDATE bookingitem bi
                        SET merchandise_variation_id = :var_id
                        FROM tripmerchandise tm
                        WHERE bi.trip_merchandise_id = tm.id
                          AND tm.merchandise_id = :merch_id
                          AND bi.variant_option = :v
                    """),
                    {"var_id": var_id, "merch_id": merch_id, "v": variant_value},
                )


def downgrade():
    op.drop_constraint(
        "fk_bookingitem_merchandise_variation_id_merchandisevariation",
        "bookingitem",
        type_="foreignkey",
    )
    op.drop_column("bookingitem", "merchandise_variation_id")
    op.drop_table("merchandisevariation")
