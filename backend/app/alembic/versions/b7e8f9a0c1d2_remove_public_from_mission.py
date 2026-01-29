"""remove_public_from_mission

Revision ID: b7e8f9a0c1d2
Revises: 99839ca7089e
Create Date: 2026-01-28

Remove redundant mission.public column. Visibility is determined by booking_mode
(private | early_bird | public).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7e8f9a0c1d2"
down_revision = "99839ca7089e"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("mission", "public")


def downgrade():
    op.add_column(
        "mission",
        sa.Column("public", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
