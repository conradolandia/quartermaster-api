"""
Boat CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Boat, BoatCreate, BoatUpdate


def create_boat(*, session: Session, boat_in: BoatCreate) -> Boat:
    """Create a new boat."""
    # Generate slug from name if not provided
    if not boat_in.slug:
        # Convert name to slug: lowercase, replace spaces with hyphens, remove special chars
        import re

        slug = re.sub(r"[^a-z0-9]+", "-", boat_in.name.lower()).strip("-")
        boat_in.slug = slug

    db_obj = Boat.model_validate(boat_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_boat(*, session: Session, boat_id: uuid.UUID) -> Boat | None:
    """Get a boat by ID."""
    return session.get(Boat, boat_id)


def get_boats(*, session: Session, skip: int = 0, limit: int = 100) -> list[Boat]:
    """Get multiple boats."""
    return session.exec(select(Boat).offset(skip).limit(limit)).all()


def get_boats_by_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Boat]:
    """Get boats by jurisdiction."""
    return session.exec(
        select(Boat)
        .where(Boat.jurisdiction_id == jurisdiction_id)
        .offset(skip)
        .limit(limit)
    ).all()


def get_boats_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get boats without loading relationships.
    Returns dictionaries with boat data.
    """
    from sqlmodel import text

    result = session.exec(
        text(
            """
            SELECT id, name, slug, capacity, provider_name, provider_location, provider_address,
                   jurisdiction_id, map_link, created_at, updated_at
            FROM boat
            ORDER BY created_at DESC
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
                "provider_name": row[4],  # provider_name
                "provider_location": row[5],  # provider_location
                "provider_address": row[6],  # provider_address
                "jurisdiction_id": row[7],  # jurisdiction_id
                "map_link": row[8],  # map_link
                "created_at": row[9],  # created_at
                "updated_at": row[10],  # updated_at
            }
        )

    return boats_data


def get_boats_count(*, session: Session) -> int:
    """Get the total count of boats."""
    count = session.exec(select(func.count(Boat.id))).first()
    return count or 0


def update_boat(*, session: Session, db_obj: Boat, obj_in: BoatUpdate) -> Boat:
    """Update a boat."""
    obj_data = obj_in.model_dump(exclude_unset=True)

    # Generate slug from name if name is being updated and slug is not provided
    if "name" in obj_data and "slug" not in obj_data:
        import re

        slug = re.sub(r"[^a-z0-9]+", "-", obj_data["name"].lower()).strip("-")
        obj_data["slug"] = slug

    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_boat(*, session: Session, db_obj: Boat) -> None:
    """Delete a boat."""
    session.delete(db_obj)
    session.commit()
