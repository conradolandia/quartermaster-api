"""create location and jurisdiction tables

Revision ID: 2a42ce608337
Revises: 1a31ce608336
Create Date: 2025-04-30 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '2a42ce608337'
down_revision: Union[str, None] = '1a31ce608336'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create location table
    op.create_table(
        'location',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('state', sa.String(2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index(op.f('ix_location_id'), 'location', ['id'], unique=True)

    # Create jurisdiction table
    op.create_table(
        'jurisdiction',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('state', sa.String(100), nullable=False),
        sa.Column('sales_tax_rate', sa.Float(), nullable=False),
        sa.Column('location_id', UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['location_id'], ['location.id'], ),
    )
    op.create_index(op.f('ix_jurisdiction_id'), 'jurisdiction', ['id'], unique=True)
    op.create_index(op.f('ix_jurisdiction_name'), 'jurisdiction', ['name'], unique=False)


def downgrade() -> None:
    # Drop jurisdiction table
    op.drop_index(op.f('ix_jurisdiction_name'), table_name='jurisdiction')
    op.drop_index(op.f('ix_jurisdiction_id'), table_name='jurisdiction')
    op.drop_table('jurisdiction')

    # Drop location table
    op.drop_index(op.f('ix_location_id'), table_name='location')
    op.drop_table('location')
