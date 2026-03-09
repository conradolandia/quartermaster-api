"""Admin booking operations: reschedule, check-in, revert check-in (superuser only)."""

import logging
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.models import (
    Boat,
    Booking,
    BookingItem,
    BookingItemPublic,
    BookingItemStatus,
    BookingPublic,
    BookingStatus,
    MerchandiseVariation,
    Trip,
)

from .booking_utils import (
    get_booking_items_in_display_order,
    validate_confirmation_code,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


class RescheduleBookingRequest(BaseModel):
    """Request body for rescheduling a booking's ticket items to another trip."""

    target_trip_id: uuid.UUID
    boat_id: uuid.UUID | None = None  # Required if target trip has more than one boat


@router.post(
    "/id/{booking_id}/reschedule",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
    operation_id="bookings_reschedule",
)
def reschedule_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    body: RescheduleBookingRequest,
) -> BookingPublic:
    """
    Move all ticket items for this booking to another trip (any mission).

    Target trip may be Launch Viewing or Pre-Launch; cross-type and cross-mission
    rescheduling are allowed. Merchandise items are left on their current trips.
    Target trip must be active, not departed, and have capacity for the moved
    quantities.
    """
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with ID {booking_id} not found",
        )
    if booking.booking_status == BookingStatus.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule a checked-in booking",
        )

    items = get_booking_items_in_display_order(session, booking.id)
    ticket_items = [i for i in items if i.trip_merchandise_id is None]
    if not ticket_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking has no ticket items to reschedule",
        )

    target_trip = session.get(Trip, body.target_trip_id)
    if not target_trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip {body.target_trip_id} not found",
        )
    if not target_trip.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target trip is not active",
        )
    trip_boats = crud.get_trip_boats_by_trip(
        session=session, trip_id=body.target_trip_id
    )
    if not trip_boats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target trip has no boats",
        )
    if len(trip_boats) == 1:
        target_boat_id = trip_boats[0].boat_id
    else:
        if body.boat_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target trip has multiple boats; boat_id is required",
            )
        boat_ids = {tb.boat_id for tb in trip_boats}
        if body.boat_id not in boat_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="boat_id is not associated with the target trip",
            )
        target_boat_id = body.boat_id

    target_trip_boat = next(
        (tb for tb in trip_boats if tb.boat_id == target_boat_id), None
    )
    if target_trip_boat and not target_trip_boat.sales_enabled:
        target_boat = session.get(Boat, target_boat_id)
        boat_name = target_boat.name if target_boat else str(target_boat_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sales are currently disabled for boat '{boat_name}' on the target trip",
        )

    capacities = crud.get_effective_capacity_per_ticket_type(
        session=session,
        trip_id=body.target_trip_id,
        boat_id=target_boat_id,
    )
    paid = crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
        session=session, trip_id=body.target_trip_id
    )
    this_booking_by_type: dict[str, int] = defaultdict(int)
    for item in ticket_items:
        this_booking_by_type[item.item_type] += item.quantity

    for item_type, qty in this_booking_by_type.items():
        cap = capacities.get(item_type)
        if cap is None and item_type not in capacities:
            boat = session.get(Boat, target_boat_id)
            boat_name = boat.name if boat else str(target_boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No capacity for ticket type '{item_type}' on boat '{boat_name}'",
            )
        if cap is not None:
            existing = paid.get((target_boat_id, item_type), 0)
            if existing + qty > cap:
                boat = session.get(Boat, target_boat_id)
                boat_name = boat.name if boat else str(target_boat_id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Boat '{boat_name}' capacity for '{item_type}' would be exceeded",
                )

    paid_total = sum(v for (bid, _), v in paid.items() if bid == target_boat_id)
    this_booking_total = sum(this_booking_by_type.values())
    trip_boat = next(
        (tb for tb in trip_boats if tb.boat_id == target_boat_id),
        None,
    )
    if trip_boat:
        boat = session.get(Boat, target_boat_id)
        effective_max = (
            trip_boat.max_capacity
            if trip_boat.max_capacity is not None
            else (boat.capacity if boat else 0)
        )
        if paid_total + this_booking_total > effective_max:
            boat = session.get(Boat, target_boat_id)
            boat_name = boat.name if boat else str(target_boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Boat '{boat_name}' has {effective_max} total seat(s) "
                    f"with {paid_total} already booked; rescheduling {this_booking_total} ticket(s) "
                    f"would exceed capacity"
                ),
            )

    for item in ticket_items:
        item.trip_id = body.target_trip_id
        item.boat_id = target_boat_id
        session.add(item)

    session.commit()
    session.refresh(booking)
    updated_items = get_booking_items_in_display_order(session, booking.id)
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [
        BookingItemPublic.model_validate(item) for item in updated_items
    ]
    logger.info(
        f"Rescheduled booking {booking_id} ticket items to trip {body.target_trip_id}"
    )
    return booking_public


@router.post(
    "/check-in/{confirmation_code}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def check_in_booking(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
    trip_id: str | None = None,
    boat_id: str | None = None,
) -> BookingPublic:
    """
    Check in a booking by confirmation code.

    Validates the booking against the selected trip/boat context and updates
    the booking status to 'checked_in' and item statuses to 'fulfilled'.
    """
    try:
        validate_confirmation_code(confirmation_code)

        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()

        if not booking:
            logger.warning(
                f"Booking not found for confirmation code: {confirmation_code}"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found with the provided confirmation code",
            )

        if booking.booking_status not in [
            BookingStatus.confirmed,
            BookingStatus.checked_in,
        ]:
            logger.warning(
                f"Invalid booking status for check-in: {booking.booking_status} (confirmation: {confirmation_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot check in booking with status '{booking.booking_status}'. Booking must be 'confirmed'.",
            )

        if trip_id and boat_id:
            matching_item = session.exec(
                select(BookingItem).where(
                    (BookingItem.booking_id == booking.id)
                    & (BookingItem.trip_id == trip_id)
                    & (BookingItem.boat_id == boat_id)
                )
            ).first()

            if not matching_item:
                logger.warning(
                    f"No matching booking item found for trip {trip_id} and boat {boat_id} "
                    f"in booking {confirmation_code}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Booking does not contain items for the specified trip and boat combination",
                )

        booking.booking_status = BookingStatus.checked_in
        session.add(booking)

        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

        for item in items:
            item.status = BookingItemStatus.fulfilled
            session.add(item)
            if item.merchandise_variation_id:
                variation = session.get(
                    MerchandiseVariation, item.merchandise_variation_id
                )
                if variation:
                    variation.quantity_fulfilled += item.quantity
                    session.add(variation)

        session.commit()
        session.refresh(booking)

        updated_items = get_booking_items_in_display_order(session, booking.id)
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in updated_items
        ]

        logger.info(f"Successfully checked in booking {confirmation_code}")
        return booking_public

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception(
            f"Unexpected error during check-in for {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during check-in. Please try again later.",
        )


@router.post(
    "/revert-check-in/{confirmation_code}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
    operation_id="bookings_revert_check_in",
)
def revert_check_in(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> BookingPublic:
    """
    Revert a checked-in booking back to confirmed.

    Allowed only when booking status is checked_in. Sets booking status to
    confirmed and all booking items back to active.
    """
    try:
        validate_confirmation_code(confirmation_code)

        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found with the provided confirmation code",
            )

        if booking.booking_status != BookingStatus.checked_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot revert check-in: booking status is '{booking.booking_status}', not 'checked_in'.",
            )

        booking.booking_status = BookingStatus.confirmed
        session.add(booking)

        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()
        for item in items:
            item.status = BookingItemStatus.active
            session.add(item)
            if item.merchandise_variation_id:
                variation = session.get(
                    MerchandiseVariation, item.merchandise_variation_id
                )
                if variation:
                    variation.quantity_fulfilled -= item.quantity
                    variation.quantity_fulfilled = max(0, variation.quantity_fulfilled)
                    session.add(variation)

        session.commit()
        session.refresh(booking)

        updated_items = get_booking_items_in_display_order(session, booking.id)
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in updated_items
        ]

        logger.info(f"Reverted check-in for booking {confirmation_code}")
        return booking_public

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception(
            f"Unexpected error reverting check-in for {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )
