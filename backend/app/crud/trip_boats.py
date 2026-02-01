"""
TripBoat CRUD operations.
"""

import uuid

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models import Boat, TripBoat, TripBoatCreate, TripBoatUpdate


def get_trip_boat(*, session: Session, trip_boat_id: uuid.UUID) -> TripBoat | None:
    """Get a trip boat by ID."""
    return session.get(TripBoat, trip_boat_id)


def get_trip_boats_by_trip(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats by trip, ordered by created_at then id (stable order when created_at ties)."""
    return session.exec(
        select(TripBoat)
        .where(TripBoat.trip_id == trip_id)
        .order_by(TripBoat.created_at.asc(), TripBoat.id.asc())
        .offset(skip)
        .limit(limit)
    ).all()


def get_trip_boats_by_trip_with_boat_provider(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats by trip with boat and provider loaded (for public booking form)."""
    return session.exec(
        select(TripBoat)
        .where(TripBoat.trip_id == trip_id)
        .options(
            selectinload(TripBoat.boat).selectinload(Boat.provider),
        )
        .order_by(TripBoat.created_at.asc(), TripBoat.id.asc())
        .offset(skip)
        .limit(limit)
    ).all()


def get_trip_boats_for_trip_ids(
    *, session: Session, trip_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[TripBoat]]:
    """Get trip boats for multiple trip ids, grouped by trip_id. Boat is loaded.
    Each trip's list is ordered by created_at then id (stable when created_at ties)."""
    if not trip_ids:
        return {}
    trip_boats_list = session.exec(
        select(TripBoat)
        .where(TripBoat.trip_id.in_(trip_ids))
        .order_by(TripBoat.trip_id, TripBoat.created_at.asc(), TripBoat.id.asc())
    ).all()
    result: dict[uuid.UUID, list[TripBoat]] = {tid: [] for tid in trip_ids}
    for tb in trip_boats_list:
        result[tb.trip_id].append(tb)
    return result


def get_trip_boats_by_boat(
    *, session: Session, boat_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats by boat, ordered by created_at then id (stable order when created_at ties)."""
    return session.exec(
        select(TripBoat)
        .where(TripBoat.boat_id == boat_id)
        .order_by(TripBoat.created_at.asc(), TripBoat.id.asc())
        .offset(skip)
        .limit(limit)
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
