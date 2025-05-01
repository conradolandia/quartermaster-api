"""add launch model

Revision ID: add_launch_model
Revises: 1a31ce608336
Create Date: 2025-04-30 22:41:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'add_launch_model'
down_revision: Union[str, None] = '2a42ce608337'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create launch table
    op.create_table(
        'launch',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('launch_timestamp', sa.DateTime(), nullable=False),
        sa.Column('summary', sa.String(1000), nullable=False),
        sa.Column('location_id', UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['location_id'], ['location.id'], ),
    )
    op.create_index(op.f('ix_launch_id'), 'launch', ['id'], unique=True)


def downgrade() -> None:
    # Drop launch table
    op.drop_index(op.f('ix_launch_id'), table_name='launch')
    op.drop_table('launch')
