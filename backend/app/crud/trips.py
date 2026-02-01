"""
Trip CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import Booking, BookingItem, Trip, TripCreate, TripUpdate


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
            SELECT t.id, t.mission_id, t.name, t.type, t.active, t.booking_mode,
                   t.check_in_time, t.boarding_time, t.departure_time,
                   t.created_at, t.updated_at, loc.timezone
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
                "name": row[2],
                "type": row[3],
                "active": row[4],
                "booking_mode": row[5] or "private",
                "check_in_time": row[6],
                "boarding_time": row[7],
                "departure_time": row[8],
                "created_at": row[9],
                "updated_at": row[10],
                "timezone": row[11] or "UTC",
            }
        )

    return trips_data


def get_trips_with_stats(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get trips without loading relationships, with total_bookings and total_sales.
    Returns dictionaries with trip data plus total_bookings and total_sales.
    """
    result = session.exec(
        text(
            """
            SELECT t.id, t.mission_id, t.name, t.type, t.active, t.booking_mode,
                   t.check_in_time, t.boarding_time, t.departure_time,
                   t.created_at, t.updated_at, loc.timezone
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
        trip_id = row[0]
        # Count distinct bookings for this trip (confirmed, checked_in, completed)
        bookings_statement = (
            select(func.count(func.distinct(Booking.id)))
            .select_from(Booking)
            .join(BookingItem, Booking.id == BookingItem.booking_id)
            .where(BookingItem.trip_id == trip_id)
            .where(Booking.status.in_(["confirmed", "checked_in", "completed"]))
        )
        total_bookings = session.exec(bookings_statement).first() or 0
        # Sum total sales for this trip (cents)
        sales_statement = (
            select(func.sum(Booking.total_amount))
            .select_from(Booking)
            .join(BookingItem, Booking.id == BookingItem.booking_id)
            .where(BookingItem.trip_id == trip_id)
            .where(Booking.status.in_(["confirmed", "checked_in", "completed"]))
        )
        total_sales = session.exec(sales_statement).first() or 0

        trips_data.append(
            {
                "id": row[0],
                "mission_id": row[1],
                "name": row[2],
                "type": row[3],
                "active": row[4],
                "booking_mode": row[5] or "private",
                "check_in_time": row[6],
                "boarding_time": row[7],
                "departure_time": row[8],
                "created_at": row[9],
                "updated_at": row[10],
                "timezone": row[11] or "UTC",
                "total_bookings": total_bookings,
                "total_sales": int(total_sales) if total_sales is not None else 0,
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
        TripBoatPricing,
        TripMerchandise,
    )

    # Get the trip first
    trip = session.get(Trip, trip_id)
    if not trip:
        return None

    # Delete in dependency order: BookingItem references trip_merchandise_id and trip_id,
    # so delete booking items first, then trip merchandise, trip_boat_pricing, boats, then trip.
    for booking_item in session.exec(
        select(BookingItem).where(BookingItem.trip_id == trip_id)
    ):
        session.delete(booking_item)

    for trip_merchandise in session.exec(
        select(TripMerchandise).where(TripMerchandise.trip_id == trip_id)
    ):
        session.delete(trip_merchandise)

    for trip_boat in session.exec(select(TripBoat).where(TripBoat.trip_id == trip_id)):
        for tbp in session.exec(
            select(TripBoatPricing).where(TripBoatPricing.trip_boat_id == trip_boat.id)
        ):
            session.delete(tbp)
        session.delete(trip_boat)

    session.delete(trip)
    session.commit()
    return trip
