"""create_provider_model_and_refactor_boats

Revision ID: 99839ca7089e
Revises: 26a5becb4e42
Create Date: 2026-01-28 14:36:57.925004

"""
from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers, used by Alembic.
revision = '99839ca7089e'
down_revision = '26a5becb4e42'
branch_labels = None
depends_on = None


def upgrade():
    # Create provider table
    op.create_table(
        'provider',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.VARCHAR(length=255), nullable=False),
        sa.Column('location', sa.VARCHAR(length=255), nullable=True),
        sa.Column('address', sa.VARCHAR(length=500), nullable=True),
        sa.Column('jurisdiction_id', sa.UUID(), nullable=False),
        sa.Column('map_link', sa.VARCHAR(length=2000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['jurisdiction_id'], ['jurisdiction.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Add provider_id column to boat table (nullable initially)
    op.add_column('boat', sa.Column('provider_id', sa.UUID(), nullable=True))

    # Migrate data: Create Provider records for each unique combination
    # and update boats with provider_id
    connection = op.get_bind()

    # Get all unique provider combinations from boats
    # Handle boats with all NULL provider fields by creating a default provider
    result = connection.execute(sa.text("""
        SELECT DISTINCT
            COALESCE(provider_name, '') as provider_name,
            provider_location,
            provider_address,
            jurisdiction_id,
            map_link
        FROM boat
    """))

    provider_map = {}  # Maps (name, location, address, jurisdiction_id, map_link) -> provider_id

    for row in result:
        provider_name = row[0] or 'Unknown Provider'
        provider_location = row[1]
        provider_address = row[2]
        jurisdiction_id = row[3]
        map_link = row[4]

        # Create a unique key for this provider combination
        provider_key = (
            provider_name,
            provider_location or '',
            provider_address or '',
            str(jurisdiction_id),
            map_link or ''
        )

        if provider_key not in provider_map:
            # Create new provider record
            provider_id = str(uuid.uuid4())
            connection.execute(sa.text("""
                INSERT INTO provider (id, name, location, address, jurisdiction_id, map_link, created_at, updated_at)
                VALUES (:id, :name, :location, :address, :jurisdiction_id, :map_link, NOW(), NOW())
            """), {
                'id': provider_id,
                'name': provider_name,
                'location': provider_location,
                'address': provider_address,
                'jurisdiction_id': str(jurisdiction_id),
                'map_link': map_link
            })
            provider_map[provider_key] = provider_id

    # Update boats with provider_id
    for provider_key, provider_id in provider_map.items():
        provider_name, provider_location, provider_address, jurisdiction_id_str, map_link = provider_key

        # Build WHERE clause conditions
        conditions = ["COALESCE(provider_name, '') = :provider_name"]
        params = {'provider_id': provider_id, 'provider_name': provider_name}

        if provider_location:
            conditions.append("provider_location = :provider_location")
            params['provider_location'] = provider_location
        else:
            conditions.append("provider_location IS NULL")

        if provider_address:
            conditions.append("provider_address = :provider_address")
            params['provider_address'] = provider_address
        else:
            conditions.append("provider_address IS NULL")

        conditions.append("jurisdiction_id = :jurisdiction_id")
        params['jurisdiction_id'] = jurisdiction_id_str

        if map_link:
            conditions.append("map_link = :map_link")
            params['map_link'] = map_link
        else:
            conditions.append("map_link IS NULL")

        where_clause = " AND ".join(conditions)

        connection.execute(sa.text(f"""
            UPDATE boat
            SET provider_id = :provider_id
            WHERE {where_clause}
        """), params)

    # Make provider_id NOT NULL
    op.alter_column('boat', 'provider_id', nullable=False)

    # Drop old provider columns from boat table
    op.drop_column('boat', 'provider_name')
    op.drop_column('boat', 'provider_location')
    op.drop_column('boat', 'provider_address')
    op.drop_column('boat', 'map_link')
    op.drop_column('boat', 'jurisdiction_id')


def downgrade():
    # Re-add old columns to boat table
    op.add_column('boat', sa.Column('jurisdiction_id', sa.UUID(), nullable=True))
    op.add_column('boat', sa.Column('map_link', sa.VARCHAR(length=2000), nullable=True))
    op.add_column('boat', sa.Column('provider_address', sa.VARCHAR(length=500), nullable=True))
    op.add_column('boat', sa.Column('provider_location', sa.VARCHAR(length=255), nullable=True))
    op.add_column('boat', sa.Column('provider_name', sa.VARCHAR(length=255), nullable=True))

    # Migrate data back: Copy provider data to boat columns
    connection = op.get_bind()
    # Use PostgreSQL-specific UPDATE ... FROM syntax
    connection.execute(sa.text("""
        UPDATE boat
        SET
            provider_name = p.name,
            provider_location = p.location,
            provider_address = p.address,
            jurisdiction_id = p.jurisdiction_id,
            map_link = p.map_link
        FROM provider p
        WHERE boat.provider_id = p.id
    """))

    # Make provider_id nullable
    op.alter_column('boat', 'provider_id', nullable=True)

    # Drop provider_id column
    op.drop_column('boat', 'provider_id')

    # Drop provider table
    op.drop_table('provider')
