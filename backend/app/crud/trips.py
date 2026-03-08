"""
Trip CRUD operations.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import Booking, BookingItem, Trip, TripBase, TripUpdate
from app.services.date_validator import effective_booking_mode


def apply_sales_open_bump_if_needed(
    *,
    session: Session,
    trip_id: uuid.UUID,
    booking_mode: str,
    sales_open_at: datetime | None,
    now: datetime | None = None,
    trip_dict_to_update: dict | None = None,
) -> str:
    """
    If now >= sales_open_at, persist the one-level booking_mode bump and clear sales_open_at.
    Returns the booking mode to use (stored or bumped). Call before using trip booking_mode.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    normalized = (
        booking_mode
        if booking_mode in ("private", "early_bird", "public")
        else "private"
    )
    effective = effective_booking_mode(normalized, sales_open_at, now)
    if effective == normalized:
        return effective
    trip = session.get(Trip, trip_id)
    if not trip:
        return effective
    trip.booking_mode = effective
    trip.sales_open_at = None
    session.add(trip)
    session.commit()
    session.refresh(trip)
    if trip_dict_to_update is not None:
        trip_dict_to_update["booking_mode"] = effective
        trip_dict_to_update["sales_open_at"] = None
    return effective


def get_trip(*, session: Session, trip_id: uuid.UUID) -> Trip | None:
    """Get a trip by ID."""
    return session.get(Trip, trip_id)


def get_trips(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> list[Trip]:
    """Get multiple trips. By default exclude archived."""
    stmt = select(Trip).order_by(Trip.check_in_time.desc()).offset(skip).limit(limit)
    if not include_archived:
        stmt = stmt.where(Trip.archived == False)  # noqa: E712
    return session.exec(stmt).unique().all()


def get_trips_no_relationships(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> list[dict]:
    """
    Get trips without loading relationships.
    Returns dictionaries with trip data. By default exclude archived.
    """
    where_clause = "" if include_archived else "WHERE t.archived = false"
    result = session.exec(
        text(
            f"""
            SELECT t.id, t.mission_id, t.name, t.type, t.active, t.unlisted, t.archived, t.booking_mode,
                   t.sales_open_at, t.check_in_time, t.boarding_time, t.departure_time,
                   t.created_at, t.updated_at, loc.timezone
            FROM trip t
            JOIN mission m ON t.mission_id = m.id
            JOIN launch l ON m.launch_id = l.id
            JOIN location loc ON l.location_id = loc.id
            {where_clause}
            ORDER BY t.check_in_time DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    trips_data = []
    for row in result:
        # row index 6 is archived, 7+ shift by one from original
        trips_data.append(
            {
                "id": row[0],
                "mission_id": row[1],
                "name": row[2],
                "type": row[3],
                "active": row[4],
                "unlisted": row[5],
                "archived": row[6] if len(row) > 6 else False,
                "booking_mode": row[7] or "private",
                "sales_open_at": row[8],
                "check_in_time": row[9],
                "boarding_time": row[10],
                "departure_time": row[11],
                "created_at": row[12],
                "updated_at": row[13],
                "timezone": row[14] or "UTC",
            }
        )

    return trips_data


def get_trips_with_stats(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    mission_id: uuid.UUID | None = None,
    type_: str | None = None,
    include_archived: bool = False,
) -> list[dict]:
    """
    Get trips without loading relationships, with total_bookings and total_sales.
    Returns dictionaries with trip data plus total_bookings and total_sales.
    By default exclude archived.
    """
    where_clauses = []
    params: dict = {"limit": limit, "skip": skip}
    if not include_archived:
        where_clauses.append("t.archived = false")
    if mission_id is not None:
        where_clauses.append("t.mission_id = :mission_id")
        params["mission_id"] = mission_id
    if type_ is not None:
        where_clauses.append("t.type = :type_")
        params["type_"] = type_
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    result = session.exec(
        text(
            f"""
            SELECT t.id, t.mission_id, t.name, t.type, t.active, t.unlisted, t.archived, t.booking_mode,
                   t.sales_open_at, t.check_in_time, t.boarding_time, t.departure_time,
                   t.created_at, t.updated_at, loc.timezone
            FROM trip t
            JOIN mission m ON t.mission_id = m.id
            JOIN launch l ON m.launch_id = l.id
            JOIN location loc ON l.location_id = loc.id
            WHERE {where_sql}
            ORDER BY t.check_in_time DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(**params)
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
            .where(Booking.booking_status.in_(["confirmed", "checked_in", "completed"]))
        )
        total_bookings = session.exec(bookings_statement).first() or 0
        # Sum total sales for this trip (cents), excluding tax.
        # Use proportional allocation: when a booking has multiple items (same or different trips),
        # attribute (trip_item_subtotal / booking_subtotal) * (total_amount - tax_amount) to this trip.
        # This avoids double-counting when one booking has multiple items for the same trip.
        sales_statement = text(
            """
            SELECT COALESCE(SUM(
                CASE WHEN b.subtotal > 0
                THEN (trip_items.trip_item_subtotal::float / b.subtotal)
                     * (b.total_amount - b.tax_amount)
                ELSE 0 END
            ), 0)::bigint
            FROM (
                SELECT bi.booking_id,
                       SUM(bi.quantity * bi.price_per_unit) AS trip_item_subtotal
                FROM bookingitem bi
                WHERE bi.trip_id = :trip_id
                  AND bi.status IN ('active', 'fulfilled')
                GROUP BY bi.booking_id
            ) trip_items
            JOIN booking b ON b.id = trip_items.booking_id
            WHERE b.booking_status IN ('confirmed', 'checked_in', 'completed')
            """
        ).params(trip_id=trip_id)
        sales_row = session.exec(sales_statement).first()
        total_sales = int(sales_row[0]) if sales_row is not None else 0

        trips_data.append(
            {
                "id": row[0],
                "mission_id": row[1],
                "name": row[2],
                "type": row[3],
                "active": row[4],
                "unlisted": row[5],
                "archived": row[6] if len(row) > 6 else False,
                "booking_mode": row[7] or "private",
                "sales_open_at": row[8],
                "check_in_time": row[9],
                "boarding_time": row[10],
                "departure_time": row[11],
                "created_at": row[12],
                "updated_at": row[13],
                "timezone": row[14] or "UTC",
                "total_bookings": total_bookings,
                "total_sales": total_sales,
            }
        )

    return trips_data


def get_trips_count(
    *,
    session: Session,
    mission_id: uuid.UUID | None = None,
    type_: str | None = None,
    include_archived: bool = False,
) -> int:
    """Get the total count of trips, optionally filtered by mission_id and type. By default exclude archived."""
    stmt = select(func.count(Trip.id))
    if not include_archived:
        stmt = stmt.where(Trip.archived == False)  # noqa: E712
    if mission_id is not None:
        stmt = stmt.where(Trip.mission_id == mission_id)
    if type_ is not None:
        stmt = stmt.where(Trip.type == type_)
    count = session.exec(stmt).first()
    return count or 0


def get_trips_by_mission(
    *,
    session: Session,
    mission_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> list[Trip]:
    """Get trips by mission. By default exclude archived."""
    stmt = (
        select(Trip)
        .where(Trip.mission_id == mission_id)
        .order_by(Trip.check_in_time.desc())
        .offset(skip)
        .limit(limit)
    )
    if not include_archived:
        stmt = stmt.where(Trip.archived == False)  # noqa: E712
    return session.exec(stmt).unique().all()


def create_trip(*, session: Session, trip_in: TripBase) -> Trip:
    """Create a new trip. Caller must provide check_in_time, boarding_time, departure_time (e.g. from trip_times helper)."""
    db_obj = Trip.model_validate(trip_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_trip(*, session: Session, db_obj: Trip, obj_in: TripUpdate | dict) -> Trip:
    """Update a trip. obj_in can be TripUpdate or a dict (e.g. with computed check_in/boarding/departure times)."""
    obj_data = (
        obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
    )
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_trip_booking_count_and_codes(
    *, session: Session, trip_id: uuid.UUID
) -> tuple[int, list[str]]:
    """Return (count, list of confirmation codes) for bookings with items on this trip."""
    rows = session.exec(
        select(Booking.confirmation_code)
        .select_from(Booking)
        .join(BookingItem, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .distinct()
    ).all()
    return len(rows), list(rows)


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
