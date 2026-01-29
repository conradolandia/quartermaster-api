"""
Trip CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import Trip, TripCreate, TripUpdate


def get_trip(*, session: Session, trip_id: uuid.UUID) -> Trip | None:
    """Get a trip by ID."""
    return session.get(Trip, trip_id)


def get_trips(*, session: Session, skip: int = 0, limit: int = 100) -> list[Trip]:
    """Get multiple trips."""
    return (
        session.exec(
            select(Trip).order_by(Trip.check_in_time.desc()).offset(skip).limit(limit)
        )
        .unique()
        .all()
    )


def get_trips_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get trips without loading relationships.
    Returns dictionaries with trip data.
    """

    result = session.exec(
        text(
            """
            SELECT t.id, t.mission_id, t.type, t.active, t.check_in_time,
                   t.boarding_time, t.departure_time, t.created_at, t.updated_at,
                   loc.timezone
            FROM trip t
            JOIN mission m ON t.mission_id = m.id
            JOIN launch l ON m.launch_id = l.id
            JOIN location loc ON l.location_id = loc.id
            ORDER BY t.check_in_time DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    trips_data = []
    for row in result:
        trips_data.append(
            {
                "id": row[0],
                "mission_id": row[1],
                "type": row[2],
                "active": row[3],
                "check_in_time": row[4],
                "boarding_time": row[5],
                "departure_time": row[6],
                "created_at": row[7],
                "updated_at": row[8],
                "timezone": row[9] or "UTC",
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
        select(Trip)
        .where(Trip.mission_id == mission_id)
        .order_by(Trip.check_in_time.desc())
        .offset(skip)
        .limit(limit)
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

    # Delete in dependency order: BookingItem references trip_merchandise_id and trip_id,
    # so delete booking items first, then trip merchandise/pricing/boats, then trip.
    for booking_item in session.exec(
        select(BookingItem).where(BookingItem.trip_id == trip_id)
    ):
        session.delete(booking_item)

    for trip_merchandise in session.exec(
        select(TripMerchandise).where(TripMerchandise.trip_id == trip_id)
    ):
        session.delete(trip_merchandise)

    for trip_pricing in session.exec(
        select(TripPricing).where(TripPricing.trip_id == trip_id)
    ):
        session.delete(trip_pricing)

    for trip_boat in session.exec(select(TripBoat).where(TripBoat.trip_id == trip_id)):
        session.delete(trip_boat)

    session.delete(trip)
    session.commit()
    return trip
