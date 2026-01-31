"""
BookingItem CRUD operations.
"""

import uuid

from sqlmodel import Session, select

from app.models import (
    Booking,
    BookingItem,
    BookingItemCreate,
    BookingItemStatus,
    BookingItemUpdate,
    BookingStatus,
)


def get_booking_item(
    *, session: Session, booking_item_id: uuid.UUID
) -> BookingItem | None:
    """Get a booking item by ID."""
    return session.get(BookingItem, booking_item_id)


def get_booking_items_by_trip(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[BookingItem]:
    """Get booking items by trip."""
    return session.exec(
        select(BookingItem)
        .where(BookingItem.trip_id == trip_id)
        .offset(skip)
        .limit(limit)
    ).all()


def get_paid_ticket_count_per_boat_for_trip(
    *, session: Session, trip_id: uuid.UUID
) -> dict[uuid.UUID, int]:
    """
    Sum ticket quantities per boat_id for paid bookings on this trip.
    Counts only ticket items (trip_merchandise_id IS NULL) with status active,
    for bookings with status confirmed, checked_in, or completed.
    Returns dict boat_id -> total passenger count.
    """
    from sqlalchemy import func

    paid_statuses = (
        BookingStatus.confirmed,
        BookingStatus.checked_in,
        BookingStatus.completed,
    )
    rows = session.exec(
        select(BookingItem.boat_id, func.sum(BookingItem.quantity).label("total"))
        .join(Booking, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(BookingItem.trip_merchandise_id.is_(None))
        .where(BookingItem.status == BookingItemStatus.active)
        .where(Booking.status.in_(paid_statuses))
        .group_by(BookingItem.boat_id)
    ).all()
    return {boat_id: int(total) for boat_id, total in rows}


def create_booking_item(
    *, session: Session, booking_item_in: BookingItemCreate
) -> BookingItem:
    """Create a new booking item."""
    db_obj = BookingItem.model_validate(booking_item_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_booking_item(
    *, session: Session, db_obj: BookingItem, obj_in: BookingItemUpdate
) -> BookingItem:
    """Update a booking item."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_booking_item(*, session: Session, booking_item_id: uuid.UUID) -> BookingItem:
    """Delete a booking item."""
    booking_item = session.get(BookingItem, booking_item_id)
    if booking_item:
        session.delete(booking_item)
        session.commit()
    return booking_item
