"""Add missing BookingStatus enum values

Revision ID: add_missing_enum_values
Revises:
Create Date: 2025-06-26 18:30:00.000000

Only runs when the bookingstatus enum already exists (e.g. existing DBs).
Fresh DBs never create this enum; later migrations use bookingstatusnew then drop bookingstatus.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_missing_enum_values'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    r = conn.execute(sa.text("SELECT 1 FROM pg_type WHERE typname = 'bookingstatus'")).fetchone()
    if not r:
        return
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'draft'")
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'pending_payment'")
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'confirmed'")
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'checked_in'")
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'completed'")
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'cancelled'")
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'refunded'")


def downgrade():
    # Note: PostgreSQL doesn't support removing enum values easily
    # This would require recreating the enum type, which is complex
    pass
