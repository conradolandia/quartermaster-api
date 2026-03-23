"""
Trip-boat row locks and capacity validation for payment holds and confirmation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.models import Boat, Booking, TripBoat


def lock_trip_boats_for_ticket_items(
    *,
    session: Session,
    trip_boat_pairs: list[tuple[uuid.UUID, uuid.UUID]],
) -> None:
    """
    Lock TripBoat rows in deterministic (trip_id, boat_id) order to reduce deadlocks.
    """
    seen: set[tuple[uuid.UUID, uuid.UUID]] = set()
    ordered: list[tuple[uuid.UUID, uuid.UUID]] = []
    for trip_id, boat_id in trip_boat_pairs:
        key = (trip_id, boat_id)
        if key not in seen:
            seen.add(key)
            ordered.append(key)
    ordered.sort(key=lambda p: (str(p[0]), str(p[1])))
    for trip_id, boat_id in ordered:
        tb = session.exec(
            select(TripBoat)
            .where(
                TripBoat.trip_id == trip_id,
                TripBoat.boat_id == boat_id,
            )
            .with_for_update()
        ).first()
        if tb is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trip {trip_id} is not associated with boat {boat_id}",
            )


def trip_boat_pairs_from_booking(booking: Booking) -> list[tuple[uuid.UUID, uuid.UUID]]:
    pairs: list[tuple[uuid.UUID, uuid.UUID]] = []
    for item in booking.items or []:
        if item.trip_merchandise_id is None:
            pairs.append((item.trip_id, item.boat_id))
    return pairs


def hold_expiry_utc() -> datetime:
    from datetime import timedelta

    return datetime.now(timezone.utc) + timedelta(
        minutes=settings.CAPACITY_HOLD_TTL_MINUTES
    )


def validate_capacity_for_booking_lines(
    *,
    session: Session,
    booking: Booking,
    exclude_booking_id: uuid.UUID | None,
) -> None:
    """
    Ensure paid + active holds + this booking's ticket quantities fit per-type and boat caps.
    Used before creating PI, on resume, and before confirm (exclude_booking_id=None includes all).
    """
    trip_ids = {i.trip_id for i in booking.items or [] if i.trip_merchandise_id is None}
    if not trip_ids:
        return

    ticket_quantity_by_trip_boat_type: dict[tuple[uuid.UUID, uuid.UUID, str], int] = {}
    ticket_quantity_by_trip_boat: dict[tuple[uuid.UUID, uuid.UUID], int] = {}
    for item in booking.items or []:
        if item.trip_merchandise_id is None:
            ticket_quantity_by_trip_boat_type[
                (item.trip_id, item.boat_id, item.item_type)
            ] = (
                ticket_quantity_by_trip_boat_type.get(
                    (item.trip_id, item.boat_id, item.item_type), 0
                )
                + item.quantity
            )
            ticket_quantity_by_trip_boat[(item.trip_id, item.boat_id)] = (
                ticket_quantity_by_trip_boat.get((item.trip_id, item.boat_id), 0)
                + item.quantity
            )

    paid_by_trip: dict[uuid.UUID, dict[tuple[uuid.UUID, str], int]] = {
        tid: crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
            session=session, trip_id=tid
        )
        for tid in trip_ids
    }
    held_by_trip: dict[uuid.UUID, dict[tuple[uuid.UUID, str], int]] = {
        tid: crud.get_held_ticket_count_per_boat_per_item_type_for_trip(
            session=session, trip_id=tid, exclude_booking_id=exclude_booking_id
        )
        for tid in trip_ids
    }

    for (
        trip_id,
        boat_id,
        item_type,
    ), new_quantity in ticket_quantity_by_trip_boat_type.items():
        capacities = crud.get_effective_capacity_per_ticket_type(
            session=session, trip_id=trip_id, boat_id=boat_id
        )
        capacity = capacities.get(item_type)
        if capacity is None and item_type not in capacities:
            boat = session.get(Boat, boat_id)
            boat_name = boat.name if boat else str(boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"No capacity configured for ticket type '{item_type}' on boat '{boat_name}'"
                ),
            )
        if capacity is not None:
            paid_by_type = paid_by_trip.get(trip_id, {})
            held_by_type = held_by_trip.get(trip_id, {})
            paid = sum(
                v
                for (bid, k), v in paid_by_type.items()
                if bid == boat_id and (k or "").lower() == (item_type or "").lower()
            )
            held = sum(
                v
                for (bid, k), v in held_by_type.items()
                if bid == boat_id and (k or "").lower() == (item_type or "").lower()
            )
            total_after = paid + held + new_quantity
            if total_after > capacity:
                boat = session.get(Boat, boat_id)
                boat_name = boat.name if boat else str(boat_id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Boat '{boat_name}' has {capacity} seat(s) for '{item_type}' "
                        f"with {paid} booked and {held} temporarily held; "
                        f"requested {new_quantity} would exceed capacity"
                    ),
                )

    paid_total_by_trip: dict[uuid.UUID, dict[uuid.UUID, int]] = {
        tid: crud.get_paid_ticket_count_per_boat_for_trip(session=session, trip_id=tid)
        for tid in trip_ids
    }
    held_total_by_trip: dict[uuid.UUID, dict[uuid.UUID, int]] = {
        tid: crud.get_held_ticket_count_per_boat_for_trip(
            session=session, trip_id=tid, exclude_booking_id=exclude_booking_id
        )
        for tid in trip_ids
    }

    for (trip_id, boat_id), new_total in ticket_quantity_by_trip_boat.items():
        trip_boat = session.exec(
            select(TripBoat).where(
                TripBoat.trip_id == trip_id,
                TripBoat.boat_id == boat_id,
            )
        ).first()
        if not trip_boat:
            continue
        boat = session.get(Boat, boat_id)
        effective_max = (
            trip_boat.max_capacity
            if trip_boat.max_capacity is not None
            else (boat.capacity if boat else 0)
        )
        paid_total = paid_total_by_trip.get(trip_id, {}).get(boat_id, 0)
        held_total = held_total_by_trip.get(trip_id, {}).get(boat_id, 0)
        total_after = paid_total + held_total + new_total
        if total_after > effective_max:
            boat_name = boat.name if boat else str(boat_id)
            remaining = max(0, effective_max - paid_total - held_total)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Boat '{boat_name}' has {effective_max} total seat(s) "
                    f"with {paid_total} booked and {held_total} temporarily held; "
                    f"requested {new_total} ticket(s) would exceed capacity "
                    f"(only {remaining} remaining)"
                ),
            )
