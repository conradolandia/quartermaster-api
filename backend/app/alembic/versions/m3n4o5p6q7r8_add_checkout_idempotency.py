"""Add checkout_idempotency for optional Idempotency-Key on checkout.

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-03-21

"""

from alembic import op
import sqlalchemy as sa


revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "checkout_idempotency",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "idempotency_key",
            sa.String(length=255),
            nullable=False,
            unique=True,
        ),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["booking.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("checkout_idempotency")
