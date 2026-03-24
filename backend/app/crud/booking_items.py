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
    PaymentStatus,
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


def get_ticket_items_by_trip_boat(
    *, session: Session, trip_id: uuid.UUID, boat_id: uuid.UUID
) -> list[BookingItem]:
    """
    All ticket items (trip_merchandise_id IS NULL) for this (trip_id, boat_id).
    Used for reassigning passengers to another boat.
    """
    return list(
        session.exec(
            select(BookingItem).where(
                BookingItem.trip_id == trip_id,
                BookingItem.boat_id == boat_id,
                BookingItem.trip_merchandise_id.is_(None),
            )
        ).all()
    )


def reassign_trip_boat_passengers(
    *,
    session: Session,
    trip_id: uuid.UUID,
    from_boat_id: uuid.UUID,
    to_boat_id: uuid.UUID,
    type_mapping: dict[str, str],
) -> int:
    """
    Set boat_id to to_boat_id and item_type from type_mapping on all ticket items
    for (trip_id, from_boat_id). Caller must validate per-type capacity on target
    and that both boats are on the trip. Every source item_type must be a key in
    type_mapping. Returns the number of passenger slots moved (sum of quantities).
    """
    items = get_ticket_items_by_trip_boat(
        session=session, trip_id=trip_id, boat_id=from_boat_id
    )
    total = 0
    for item in items:
        target_type = type_mapping.get(item.item_type)
        if target_type is None:
            raise ValueError(
                f"Ticket type '{item.item_type}' has no mapping to target boat type"
            )
        item.boat_id = to_boat_id
        item.item_type = target_type
        total += item.quantity
        session.add(item)
    if items:
        session.commit()
    return total


def get_ticket_item_count_for_trip_boat(
    *, session: Session, trip_id: uuid.UUID, boat_id: uuid.UUID
) -> int:
    """
    Total ticket quantity for this (trip_id, boat_id).
    Counts all ticket items (trip_merchandise_id IS NULL) regardless of booking status.
    Used to block boat removal when any bookings reference it.
    """
    from sqlalchemy import func

    row = session.exec(
        select(func.coalesce(func.sum(BookingItem.quantity), 0)).where(
            BookingItem.trip_id == trip_id,
            BookingItem.boat_id == boat_id,
            BookingItem.trip_merchandise_id.is_(None),
        )
    ).first()
    return int(row) if row is not None else 0


def get_ticket_item_count_per_type_for_trip_boat(
    *, session: Session, trip_id: uuid.UUID, boat_id: uuid.UUID
) -> dict[str, int]:
    """
    Total ticket quantity per item_type for this (trip_id, boat_id).
    Counts all ticket items (trip_merchandise_id IS NULL) regardless of booking status.
    Used for reassign UI and per-type capacity validation.
    """
    from sqlalchemy import func

    rows = session.exec(
        select(
            BookingItem.item_type,
            func.sum(BookingItem.quantity).label("total"),
        )
        .where(
            BookingItem.trip_id == trip_id,
            BookingItem.boat_id == boat_id,
            BookingItem.trip_merchandise_id.is_(None),
        )
        .group_by(BookingItem.item_type)
    ).all()
    return {item_type: int(total) for item_type, total in rows}


def get_held_ticket_count_per_boat_for_trip(
    *,
    session: Session,
    trip_id: uuid.UUID,
    exclude_booking_id: uuid.UUID | None = None,
) -> dict[uuid.UUID, int]:
    """
    Sum ticket quantities per boat_id for active payment holds on this trip.
    Holds: pending_payment, capacity_hold_expires_at in the future, draft booking
    (checkout in progress), ticket items active or fulfilled.
    """
    from datetime import datetime, timezone

    from sqlalchemy import func

    now = datetime.now(timezone.utc)
    item_statuses_counted = (
        BookingItemStatus.active,
        BookingItemStatus.fulfilled,
    )
    stmt = (
        select(BookingItem.boat_id, func.sum(BookingItem.quantity).label("total"))
        .join(Booking, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(BookingItem.trip_merchandise_id.is_(None))
        .where(BookingItem.status.in_(item_statuses_counted))
        .where(Booking.payment_status == PaymentStatus.pending_payment)
        .where(Booking.capacity_hold_expires_at.is_not(None))
        .where(Booking.capacity_hold_expires_at > now)
        .where(Booking.booking_status == BookingStatus.draft)
    )
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)
    stmt = stmt.group_by(BookingItem.boat_id)
    rows = session.exec(stmt).all()
    return {boat_id: int(total) for boat_id, total in rows}


def get_held_ticket_count_per_boat_per_item_type_for_trip(
    *,
    session: Session,
    trip_id: uuid.UUID,
    exclude_booking_id: uuid.UUID | None = None,
) -> dict[tuple[uuid.UUID, str], int]:
    """Held counts per (boat_id, item_type) for active payment holds."""
    from datetime import datetime, timezone

    from sqlalchemy import func

    now = datetime.now(timezone.utc)
    item_statuses_counted = (
        BookingItemStatus.active,
        BookingItemStatus.fulfilled,
    )
    stmt = (
        select(
            BookingItem.boat_id,
            BookingItem.item_type,
            func.sum(BookingItem.quantity).label("total"),
        )
        .join(Booking, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(BookingItem.trip_merchandise_id.is_(None))
        .where(BookingItem.status.in_(item_statuses_counted))
        .where(Booking.payment_status == PaymentStatus.pending_payment)
        .where(Booking.capacity_hold_expires_at.is_not(None))
        .where(Booking.capacity_hold_expires_at > now)
        .where(Booking.booking_status == BookingStatus.draft)
    )
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)
    stmt = stmt.group_by(BookingItem.boat_id, BookingItem.item_type)
    rows = session.exec(stmt).all()
    return {(boat_id, item_type): int(total) for boat_id, item_type, total in rows}


def get_paid_ticket_count_per_boat_for_trip(
    *, session: Session, trip_id: uuid.UUID
) -> dict[uuid.UUID, int]:
    """
    Sum ticket quantities per boat_id for paid bookings on this trip.
    Counts ticket items (trip_merchandise_id IS NULL) with status active or
    fulfilled (confirmed, checked_in, and completed all consume capacity).
    Returns dict boat_id -> total passenger count.
    """
    from sqlalchemy import func

    paid_statuses = (
        BookingStatus.confirmed,
        BookingStatus.checked_in,
        BookingStatus.completed,
    )
    item_statuses_counted = (
        BookingItemStatus.active,
        BookingItemStatus.fulfilled,
    )
    rows = session.exec(
        select(BookingItem.boat_id, func.sum(BookingItem.quantity).label("total"))
        .join(Booking, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(BookingItem.trip_merchandise_id.is_(None))
        .where(BookingItem.status.in_(item_statuses_counted))
        .where(Booking.booking_status.in_(paid_statuses))
        .group_by(BookingItem.boat_id)
    ).all()
    return {boat_id: int(total) for boat_id, total in rows}


def get_paid_ticket_count_per_boat_per_item_type_for_trip(
    *, session: Session, trip_id: uuid.UUID
) -> dict[tuple[uuid.UUID, str], int]:
    """
    Sum ticket quantities per (boat_id, item_type) for paid bookings on this trip.
    Counts ticket items (trip_merchandise_id IS NULL) with status active or
    fulfilled (confirmed, checked_in, and completed all consume capacity).
    Returns dict (boat_id, item_type) -> count.
    """
    from sqlalchemy import func

    paid_statuses = (
        BookingStatus.confirmed,
        BookingStatus.checked_in,
        BookingStatus.completed,
    )
    item_statuses_counted = (
        BookingItemStatus.active,
        BookingItemStatus.fulfilled,
    )
    rows = session.exec(
        select(
            BookingItem.boat_id,
            BookingItem.item_type,
            func.sum(BookingItem.quantity).label("total"),
        )
        .join(Booking, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(BookingItem.trip_merchandise_id.is_(None))
        .where(BookingItem.status.in_(item_statuses_counted))
        .where(Booking.booking_status.in_(paid_statuses))
        .group_by(BookingItem.boat_id, BookingItem.item_type)
    ).all()
    return {(boat_id, item_type): int(total) for boat_id, item_type, total in rows}


def merge_paid_and_held_per_boat_item_type(
    paid: dict[tuple[uuid.UUID, str], int],
    held: dict[tuple[uuid.UUID, str], int],
) -> dict[tuple[uuid.UUID, str], int]:
    """Combine paid and active-hold ticket counts for pricing / remaining capacity."""
    out = dict(paid)
    for k, v in held.items():
        out[k] = out.get(k, 0) + v
    return out


def paid_ticket_counts_by_type_for_boat(
    *,
    paid_by_type: dict[tuple[uuid.UUID, str], int],
    boat_id: uuid.UUID,
) -> dict[str, int]:
    """
    Slice per-boat ticket counts from a (boat_id, item_type) -> count map.

    `paid_by_type` may be paid-only from get_paid_ticket_count_per_boat_per_item_type_for_trip,
    or merged paid+held from merge_paid_and_held_per_boat_item_type. Used for trip-boat API
    responses and committed_per_ticket_type (paid-only slice).
    """
    out: dict[str, int] = {}
    for (bid, item_type), cnt in paid_by_type.items():
        if bid == boat_id:
            out[item_type] = cnt
    return out


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
