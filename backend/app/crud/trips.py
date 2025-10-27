"""
Trip CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Trip, TripCreate, TripUpdate


def get_trip(*, session: Session, trip_id: uuid.UUID) -> Trip | None:
    """Get a trip by ID."""
    return session.get(Trip, trip_id)


def get_trips(*, session: Session, skip: int = 0, limit: int = 100) -> list[Trip]:
    """Get multiple trips."""
    return session.exec(select(Trip).offset(skip).limit(limit)).all()


def get_trips_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get trips without loading relationships.
    Returns dictionaries with trip data.
    """
    from sqlmodel import text

    result = session.exec(
        text(
            """
            SELECT id, mission_id, type, active, check_in_time, boarding_time, departure_time, created_at, updated_at
            FROM trip
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    trips_data = []
    for row in result:
        trips_data.append(
            {
                "id": row[0],  # id
                "mission_id": row[1],  # mission_id
                "type": row[2],  # type
                "active": row[3],  # active
                "check_in_time": row[4],  # check_in_time
                "boarding_time": row[5],  # boarding_time
                "departure_time": row[6],  # departure_time
                "created_at": row[7],  # created_at
                "updated_at": row[8],  # updated_at
            }
        )

    return trips_data


def get_trips_count(*, session: Session) -> int:
    """Get the total count of trips."""
    count = session.exec(select(func.count(Trip.id))).first()
    return count or 0


def get_trips_by_mission(
    *, session: Session, mission_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Trip]:
    """Get trips by mission."""
    return session.exec(
        select(Trip).where(Trip.mission_id == mission_id).offset(skip).limit(limit)
    ).all()


def create_trip(*, session: Session, trip_in: TripCreate) -> Trip:
    """Create a new trip."""
    db_obj = Trip.model_validate(trip_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_trip(*, session: Session, db_obj: Trip, obj_in: TripUpdate) -> Trip:
    """Update a trip."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip(*, session: Session, trip_id: uuid.UUID) -> Trip:
    """Delete a trip and all related data."""
    from app.models import (
        BookingItem,
        TripBoat,
        TripMerchandise,
        TripPricing,
    )

    # Get the trip first
    trip = session.get(Trip, trip_id)
    if not trip:
        return None

    # Delete all related data
    # Delete trip boats
    session.exec(select(TripBoat).where(TripBoat.trip_id == trip_id)).all()
    for trip_boat in session.exec(select(TripBoat).where(TripBoat.trip_id == trip_id)):
        session.delete(trip_boat)

    # Delete trip pricing
    for trip_pricing in session.exec(
        select(TripPricing).where(TripPricing.trip_id == trip_id)
    ):
        session.delete(trip_pricing)

    # Delete trip merchandise
    for trip_merchandise in session.exec(
        select(TripMerchandise).where(TripMerchandise.trip_id == trip_id)
    ):
        session.delete(trip_merchandise)

    # Delete booking items
    for booking_item in session.exec(
        select(BookingItem).where(BookingItem.trip_id == trip_id)
    ):
        session.delete(booking_item)

    # Finally delete the trip
    session.delete(trip)
    session.commit()
    return trip
