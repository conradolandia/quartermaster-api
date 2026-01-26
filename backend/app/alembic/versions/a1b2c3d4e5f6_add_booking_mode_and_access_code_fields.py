"""add_booking_mode_and_access_code_fields

Revision ID: a1b2c3d4e5f6
Revises: 2baf1908bed6
Create Date: 2026-01-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '2baf1908bed6'
branch_labels = None
depends_on = None


def upgrade():
    # Add booking_mode to mission table
    op.add_column('mission', sa.Column('booking_mode', sa.String(length=20), nullable=False, server_default='private'))

    # Add access code fields to discountcode table
    op.add_column('discountcode', sa.Column('is_access_code', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('discountcode', sa.Column('access_code_mission_id', sa.Uuid(), nullable=True))


def downgrade():
    # Remove access code fields from discountcode table
    op.drop_column('discountcode', 'access_code_mission_id')
    op.drop_column('discountcode', 'is_access_code')

    # Remove booking_mode from mission table
    op.drop_column('mission', 'booking_mode')
