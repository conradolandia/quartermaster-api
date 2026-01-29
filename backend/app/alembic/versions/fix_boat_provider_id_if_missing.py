"""fix boat provider_id if missing

One-off: run boat refactor when provider table exists but boat still has old
columns (provider_name, etc.) and no provider_id. Handles DBs where migration
99839ca7089e was skipped (provider already existed) so boat was never updated.

Revision ID: fix_boat_provider_id
Revises: d6e7f8a9b0c1
Create Date: 2026-01-29

"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "fix_boat_provider_id"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None



def _boat_has_provider_id(inspector) -> bool:
    if not inspector.has_table("boat"):
        return False
    cols = [c["name"] for c in inspector.get_columns("boat")]
    return "provider_id" in cols


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    if _boat_has_provider_id(inspector):
        return

    op.add_column("boat", sa.Column("provider_id", sa.UUID(), nullable=True))

    result = conn.execute(sa.text("""
        SELECT DISTINCT
            COALESCE(provider_name, '') as provider_name,
            provider_location,
            provider_address,
            jurisdiction_id,
            map_link
        FROM boat
    """))

    provider_map = {}
    for row in result:
        provider_name = row[0] or "Unknown Provider"
        provider_location = row[1]
        provider_address = row[2]
        jurisdiction_id = row[3]
        map_link = row[4]
        provider_key = (
            provider_name,
            provider_location or "",
            provider_address or "",
            str(jurisdiction_id),
            map_link or "",
        )

        if provider_key not in provider_map:
            existing = conn.execute(
                sa.text("""
                SELECT id FROM provider
                WHERE name = :name AND (location IS NOT DISTINCT FROM :loc)
                AND (address IS NOT DISTINCT FROM :addr) AND jurisdiction_id = :jid
                AND (map_link IS NOT DISTINCT FROM :map)
                LIMIT 1
                """),
                {
                    "name": provider_name,
                    "loc": provider_location,
                    "addr": provider_address,
                    "jid": jurisdiction_id,
                    "map": map_link,
                },
            ).fetchone()
            if existing:
                provider_map[provider_key] = str(existing[0])
            else:
                provider_id = str(uuid.uuid4())
                conn.execute(
                    sa.text("""
                    INSERT INTO provider (id, name, location, address, jurisdiction_id, map_link, created_at, updated_at)
                    VALUES (:id, :name, :location, :address, :jurisdiction_id, :map_link, NOW(), NOW())
                    """),
                    {
                        "id": provider_id,
                        "name": provider_name,
                        "location": provider_location,
                        "address": provider_address,
                        "jurisdiction_id": str(jurisdiction_id),
                        "map_link": map_link,
                    },
                )
                provider_map[provider_key] = provider_id

    for provider_key, provider_id in provider_map.items():
        provider_name, provider_location, provider_address, jurisdiction_id_str, map_link = provider_key
        conditions = ["COALESCE(provider_name, '') = :provider_name"]
        params = {"provider_id": provider_id, "provider_name": provider_name}
        if provider_location:
            conditions.append("provider_location = :provider_location")
            params["provider_location"] = provider_location
        else:
            conditions.append("provider_location IS NULL")
        if provider_address:
            conditions.append("provider_address = :provider_address")
            params["provider_address"] = provider_address
        else:
            conditions.append("provider_address IS NULL")
        conditions.append("jurisdiction_id = :jurisdiction_id")
        params["jurisdiction_id"] = jurisdiction_id_str
        if map_link:
            conditions.append("map_link = :map_link")
            params["map_link"] = map_link
        else:
            conditions.append("map_link IS NULL")
        where_clause = " AND ".join(conditions)
        conn.execute(
            sa.text(f"UPDATE boat SET provider_id = :provider_id WHERE {where_clause}"),
            params,
        )

    op.alter_column("boat", "provider_id", nullable=False)
    op.drop_column("boat", "provider_name")
    op.drop_column("boat", "provider_location")
    op.drop_column("boat", "provider_address")
    op.drop_column("boat", "map_link")
    op.drop_column("boat", "jurisdiction_id")


def downgrade():
    # Not reversible without restoring old boat columns; leave no-op or optional
    pass
