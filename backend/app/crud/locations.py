"""
Location CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import Location, LocationCreate, LocationUpdate


def create_location(*, session: Session, location_in: LocationCreate) -> Location:
    """Create a new location."""
    db_obj = Location.model_validate(location_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_location(*, session: Session, location_id: uuid.UUID) -> Location | None:
    """Get a location by ID."""
    return session.get(Location, location_id)


def get_locations(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Location]:
    """Get multiple locations."""
    return session.exec(select(Location).offset(skip).limit(limit)).all()


def get_locations_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get locations without loading relationships.
    Returns dictionaries with location data.
    """

    result = session.exec(
        text(
            """
            SELECT id, name, state, timezone, created_at, updated_at
            FROM location
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    locations_data = []
    for row in result:
        locations_data.append(
            {
                "id": row[0],
                "name": row[1],
                "state": row[2],
                "timezone": row[3],
                "created_at": row[4],
                "updated_at": row[5],
            }
        )

    return locations_data


def get_locations_count(*, session: Session) -> int:
    """Get the total count of locations."""
    count = session.exec(select(func.count(Location.id))).first()
    return count or 0


def update_location(
    *, session: Session, db_obj: Location, obj_in: LocationUpdate
) -> Location:
    """Update a location."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_location(*, session: Session, db_obj: Location) -> None:
    """Delete a location. Fails if any launches or jurisdictions use it."""
    from app.models import Jurisdiction, Launch

    launches_count = (
        session.exec(
            select(func.count(Launch.id)).where(Launch.location_id == db_obj.id)
        ).first()
        or 0
    )
    if launches_count > 0:
        raise ValueError(
            f"Cannot delete this location: {launches_count} launch(es) use it. Remove or reassign those launches first."
        )
    jurisdictions_count = (
        session.exec(
            select(func.count(Jurisdiction.id)).where(
                Jurisdiction.location_id == db_obj.id
            )
        ).first()
        or 0
    )
    if jurisdictions_count > 0:
        raise ValueError(
            f"Cannot delete this location: {jurisdictions_count} jurisdiction(s) use it. Reassign or remove those jurisdictions first."
        )
    session.delete(db_obj)
    session.commit()
