"""Merge multiple heads

Revision ID: m5n6o7p8q9r0
Revises: g0h1i2j3k4l5, fix_tripmerch_merch_id
Create Date: 2026-01-30

Merges the amounts-to-cents branch with the trip merchandise fix branch.
"""
from alembic import op


revision = "m5n6o7p8q9r0"
down_revision = ("g0h1i2j3k4l5", "fix_tripmerch_merch_id")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
