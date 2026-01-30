"""Amounts and prices to integer cents

Revision ID: g0h1i2j3k4l5
Revises: 54f24cc0ec62
Create Date: 2026-01-30

Stores all monetary amounts and prices as integer cents to avoid floating-point
precision issues. Tax rate (jurisdiction) and discount percentage remain float.
"""
from alembic import op
import sqlalchemy as sa


revision = "g0h1i2j3k4l5"
down_revision = "54f24cc0ec62"
branch_labels = None
depends_on = None


def upgrade():
    # booking: subtotal, discount_amount, tax_amount, tip_amount, total_amount
    op.alter_column(
        "booking",
        "subtotal",
        type_=sa.Integer(),
        postgresql_using="(ROUND(subtotal * 100)::INTEGER)",
    )
    op.alter_column(
        "booking",
        "discount_amount",
        type_=sa.Integer(),
        postgresql_using="(ROUND(discount_amount * 100)::INTEGER)",
    )
    op.alter_column(
        "booking",
        "tax_amount",
        type_=sa.Integer(),
        postgresql_using="(ROUND(tax_amount * 100)::INTEGER)",
    )
    op.alter_column(
        "booking",
        "tip_amount",
        type_=sa.Integer(),
        postgresql_using="(ROUND(tip_amount * 100)::INTEGER)",
    )
    op.alter_column(
        "booking",
        "total_amount",
        type_=sa.Integer(),
        postgresql_using="(ROUND(total_amount * 100)::INTEGER)",
    )

    # bookingitem: price_per_unit
    op.alter_column(
        "bookingitem",
        "price_per_unit",
        type_=sa.Integer(),
        postgresql_using="(ROUND(price_per_unit * 100)::INTEGER)",
    )

    # trippricing: price
    op.alter_column(
        "trippricing",
        "price",
        type_=sa.Integer(),
        postgresql_using="(ROUND(price * 100)::INTEGER)",
    )

    # merchandise: price
    op.alter_column(
        "merchandise",
        "price",
        type_=sa.Integer(),
        postgresql_using="(ROUND(price * 100)::INTEGER)",
    )

    # tripmerchandise: price_override (nullable)
    op.execute(
        """
        ALTER TABLE tripmerchandise
        ALTER COLUMN price_override TYPE INTEGER
        USING CASE WHEN price_override IS NOT NULL THEN ROUND(price_override * 100)::INTEGER ELSE NULL END
        """
    )

    # discountcode: min_order_amount, max_discount_amount (nullable)
    op.execute(
        """
        ALTER TABLE discountcode
        ALTER COLUMN min_order_amount TYPE INTEGER
        USING CASE WHEN min_order_amount IS NOT NULL THEN ROUND(min_order_amount * 100)::INTEGER ELSE NULL END
        """
    )
    op.execute(
        """
        ALTER TABLE discountcode
        ALTER COLUMN max_discount_amount TYPE INTEGER
        USING CASE WHEN max_discount_amount IS NOT NULL THEN ROUND(max_discount_amount * 100)::INTEGER ELSE NULL END
        """
    )

    # discount_value for fixed_amount: convert dollar to cents; percentage stays 0-1
    op.execute(
        """
        UPDATE discountcode
        SET discount_value = ROUND(discount_value * 100)
        WHERE discount_type = 'fixed_amount'
        """
    )


def downgrade():
    # discountcode: revert discount_value for fixed_amount (cents -> dollars)
    op.execute(
        """
        UPDATE discountcode
        SET discount_value = discount_value / 100.0
        WHERE discount_type = 'fixed_amount'
        """
    )
    op.alter_column(
        "discountcode",
        "max_discount_amount",
        type_=sa.Float(),
        postgresql_using="(max_discount_amount / 100.0)",
    )
    op.alter_column(
        "discountcode",
        "min_order_amount",
        type_=sa.Float(),
        postgresql_using="(min_order_amount / 100.0)",
    )

    op.alter_column(
        "tripmerchandise",
        "price_override",
        type_=sa.Float(),
        postgresql_using="(price_override / 100.0)",
    )
    op.alter_column(
        "merchandise",
        "price",
        type_=sa.Float(),
        postgresql_using="(price / 100.0)",
    )
    op.alter_column(
        "trippricing",
        "price",
        type_=sa.Float(),
        postgresql_using="(price / 100.0)",
    )
    op.alter_column(
        "bookingitem",
        "price_per_unit",
        type_=sa.Float(),
        postgresql_using="(price_per_unit / 100.0)",
    )
    op.alter_column(
        "booking",
        "total_amount",
        type_=sa.Float(),
        postgresql_using="(total_amount / 100.0)",
    )
    op.alter_column(
        "booking",
        "tip_amount",
        type_=sa.Float(),
        postgresql_using="(tip_amount / 100.0)",
    )
    op.alter_column(
        "booking",
        "tax_amount",
        type_=sa.Float(),
        postgresql_using="(tax_amount / 100.0)",
    )
    op.alter_column(
        "booking",
        "discount_amount",
        type_=sa.Float(),
        postgresql_using="(discount_amount / 100.0)",
    )
    op.alter_column(
        "booking",
        "subtotal",
        type_=sa.Float(),
        postgresql_using="(subtotal / 100.0)",
    )
