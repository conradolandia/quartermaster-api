"""
Boat CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select, text

from app.models import Boat, BoatCreate, BoatUpdate


def create_boat(*, session: Session, boat_in: BoatCreate) -> Boat:
    """Create a new boat."""
    # Verify provider exists
    from app.crud.providers import get_provider

    provider = get_provider(session=session, provider_id=boat_in.provider_id)
    if not provider:
        raise ValueError(f"Provider with ID {boat_in.provider_id} not found")

    # Generate slug from name if not provided
    if not boat_in.slug:
        # Convert name to slug: lowercase, replace spaces with hyphens, remove special chars
        import re

        slug = re.sub(r"[^a-z0-9]+", "-", boat_in.name.lower()).strip("-")
        boat_in.slug = slug

    db_obj = Boat.model_validate(boat_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj, ["provider"])
    return db_obj


def get_boat(*, session: Session, boat_id: uuid.UUID) -> Boat | None:
    """Get a boat by ID."""
    statement = (
        select(Boat).where(Boat.id == boat_id).options(selectinload(Boat.provider))
    )
    boat = session.exec(statement).first()
    return boat


def get_boats(*, session: Session, skip: int = 0, limit: int = 100) -> list[Boat]:
    """Get multiple boats."""
    statement = (
        select(Boat).offset(skip).limit(limit).options(selectinload(Boat.provider))
    )
    return session.exec(statement).all()


def get_boats_by_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Boat]:
    """Get boats by jurisdiction (via provider)."""
    from app.models import Provider

    statement = (
        select(Boat)
        .join(Provider)
        .where(Provider.jurisdiction_id == jurisdiction_id)
        .options(selectinload(Boat.provider))
        .offset(skip)
        .limit(limit)
    )
    boats = session.exec(statement).all()
    return boats


def get_boats_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get boats without loading relationships.
    Returns dictionaries with boat data including provider info via JOIN.
    """

    result = session.exec(
        text(
            """
            SELECT
                b.id, b.name, b.slug, b.capacity, b.provider_id,
                b.created_at, b.updated_at,
                p.name as provider_name, p.location as provider_location,
                p.address as provider_address, p.jurisdiction_id, p.map_link
            FROM boat b
            JOIN provider p ON b.provider_id = p.id
            ORDER BY b.created_at DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    boats_data = []
    for row in result:
        boats_data.append(
            {
                "id": row[0],  # id
                "name": row[1],  # name
                "slug": row[2],  # slug
                "capacity": row[3],  # capacity
                "provider_id": row[4],  # provider_id
                "created_at": row[5],  # created_at
                "updated_at": row[6],  # updated_at
                "provider_name": row[7],  # provider_name
                "provider_location": row[8],  # provider_location
                "provider_address": row[9],  # provider_address
                "jurisdiction_id": row[10],  # jurisdiction_id (from provider)
                "map_link": row[11],  # map_link (from provider)
            }
        )

    return boats_data


def get_boats_count(*, session: Session) -> int:
    """Get the total count of boats."""
    count = session.exec(select(func.count(Boat.id))).first()
    return count or 0


def update_boat(*, session: Session, db_obj: Boat, obj_in: BoatUpdate) -> Boat:
    """Update a boat."""
    from app.crud.providers import get_provider

    obj_data = obj_in.model_dump(exclude_unset=True)

    # If provider_id is being updated, verify the new provider exists
    if "provider_id" in obj_data and obj_data["provider_id"] != db_obj.provider_id:
        provider = get_provider(session=session, provider_id=obj_data["provider_id"])
        if not provider:
            raise ValueError(f"Provider with ID {obj_data['provider_id']} not found")

    # Generate slug from name if name is being updated and slug is not provided
    if "name" in obj_data and "slug" not in obj_data:
        import re

        slug = re.sub(r"[^a-z0-9]+", "-", obj_data["name"].lower()).strip("-")
        obj_data["slug"] = slug

    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj, ["provider"])
    return db_obj


def delete_boat(*, session: Session, db_obj: Boat) -> None:
    """Delete a boat."""
    session.delete(db_obj)
    session.commit()
