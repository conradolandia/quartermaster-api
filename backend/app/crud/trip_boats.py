"""
TripBoat CRUD operations.
"""

import uuid

from sqlmodel import Session, select

from app.models import TripBoat, TripBoatCreate, TripBoatUpdate


def get_trip_boat(*, session: Session, trip_boat_id: uuid.UUID) -> TripBoat | None:
    """Get a trip boat by ID."""
    return session.get(TripBoat, trip_boat_id)


def get_trip_boats_by_trip(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats by trip."""
    return session.exec(
        select(TripBoat).where(TripBoat.trip_id == trip_id).offset(skip).limit(limit)
    ).all()


def get_trip_boats_by_boat(
    *, session: Session, boat_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats by boat."""
    return session.exec(
        select(TripBoat).where(TripBoat.boat_id == boat_id).offset(skip).limit(limit)
    ).all()


def create_trip_boat(*, session: Session, trip_boat_in: TripBoatCreate) -> TripBoat:
    """Create a new trip boat."""
    db_obj = TripBoat.model_validate(trip_boat_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_trip_boat(
    *, session: Session, db_obj: TripBoat, obj_in: TripBoatUpdate
) -> TripBoat:
    """Update a trip boat."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip_boat(*, session: Session, trip_boat_id: uuid.UUID) -> TripBoat:
    """Delete a trip boat."""
    trip_boat = session.get(TripBoat, trip_boat_id)
    if trip_boat:
        session.delete(trip_boat)
        session.commit()
    return trip_boat
