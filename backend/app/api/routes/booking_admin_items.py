"""Admin booking item endpoints: add item, update item (superuser only)."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.models import (
    Boat,
    Booking,
    BookingItem,
    BookingItemCreate,
    BookingItemPublic,
    BookingItemStatus,
    BookingItemUpdate,
    BookingPublic,
    BookingStatus,
    Launch,
    Mission,
    Trip,
)

from .booking_utils import (
    compute_booking_totals,
    get_booking_items_in_display_order,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post(
    "/id/{booking_id}/items",
    response_model=BookingPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.get_current_active_superuser)],
    operation_id="bookings_add_booking_item",
)
def add_booking_item(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    item_in: BookingItemCreate,
) -> BookingPublic:
    """
    Add a ticket item to an existing booking (admin only).
    Trip must match an existing ticket item's trip (same mission).
    Validates capacity and sets price from effective pricing.
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
            detail="Cannot add items to a checked-in booking",
        )
    if item_in.trip_merchandise_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use this endpoint for tickets only; merchandise not supported",
        )

    trip = session.get(Trip, item_in.trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {item_in.trip_id} not found",
        )
    trip_boats = crud.get_trip_boats_by_trip(
        session=session, trip_id=item_in.trip_id, limit=100
    )
    boat_ids_on_trip = {tb.boat_id for tb in trip_boats}
    if item_in.boat_id not in boat_ids_on_trip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Boat is not on this trip",
        )

    existing_items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()
    existing_trip_ids = {i.trip_id for i in existing_items if not i.trip_merchandise_id}
    if existing_trip_ids and item_in.trip_id not in existing_trip_ids:
        mission = session.get(Mission, trip.mission_id)
        first_trip = session.get(Trip, next(iter(existing_trip_ids)))
        first_mission = (
            session.get(Mission, first_trip.mission_id) if first_trip else None
        )
        if not mission or not first_mission or mission.id != first_mission.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New ticket must be for a trip in the same mission as existing tickets",
            )

    effective = crud.get_effective_pricing(
        session=session,
        trip_id=item_in.trip_id,
        boat_id=item_in.boat_id,
    )
    by_type = {p.ticket_type: p for p in effective}
    if item_in.item_type not in by_type:
        boat = session.get(Boat, item_in.boat_id)
        boat_name = boat.name if boat else str(item_in.boat_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticket type '{item_in.item_type}' is not available for boat '{boat_name}'",
        )
    pricing = by_type[item_in.item_type]
    capacities = crud.get_effective_capacity_per_ticket_type(
        session=session,
        trip_id=item_in.trip_id,
        boat_id=item_in.boat_id,
    )
    cap = capacities.get(item_in.item_type)
    if cap is not None:
        paid = crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
            session=session, trip_id=item_in.trip_id
        ).get((item_in.boat_id, item_in.item_type), 0)
        if paid + item_in.quantity > cap:
            boat = session.get(Boat, item_in.boat_id)
            boat_name = boat.name if boat else str(item_in.boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Boat '{boat_name}' capacity for '{item_in.item_type}' would be exceeded",
            )

    new_item = BookingItem(
        booking=booking,
        trip_id=item_in.trip_id,
        boat_id=item_in.boat_id,
        trip_merchandise_id=None,
        merchandise_variation_id=None,
        item_type=item_in.item_type,
        quantity=item_in.quantity,
        price_per_unit=pricing.price,
        status=BookingItemStatus.active,
        refund_reason=None,
        refund_notes=None,
        variant_option=None,
    )
    session.add(new_item)
    session.commit()
    session.refresh(new_item)

    items = get_booking_items_in_display_order(session, booking.id)
    new_subtotal = sum(i.price_per_unit * i.quantity for i in items)
    booking.subtotal = new_subtotal
    if trip:
        mission = session.get(Mission, trip.mission_id)
        launch = session.get(Launch, mission.launch_id) if mission else None
        tax_rate = None
        if launch is not None:
            jurisdictions = crud.get_jurisdictions_by_location(
                session=session, location_id=launch.location_id, limit=1
            )
            if jurisdictions:
                tax_rate = jurisdictions[0].sales_tax_rate
        if tax_rate is not None:
            new_tax, new_total = compute_booking_totals(
                new_subtotal,
                booking.discount_amount,
                tax_rate,
                booking.tip_amount,
            )
            booking.tax_amount = new_tax
            booking.total_amount = new_total
    session.add(booking)
    session.commit()
    session.refresh(booking)

    updated_items = get_booking_items_in_display_order(session, booking.id)
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [BookingItemPublic.model_validate(i) for i in updated_items]
    return booking_public


@router.patch(
    "/id/{booking_id}/items/{item_id}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
    operation_id="bookings_update_booking_item",
)
def update_booking_item(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    item_id: uuid.UUID,
    item_in: BookingItemUpdate,
) -> BookingPublic:
    """
    Update a single booking item (admin only). Change ticket type (e.g. upper to lower deck) or boat.

    Only ticket items (non-merchandise) can have item_type, price_per_unit, or boat_id changed.
    When item_type or boat_id is changed, price_per_unit is set from effective pricing and capacity is validated.
    Boat can only be changed to another boat on the same trip; target boat must have the (current or new) ticket type.
    Booking subtotal and totals are recomputed after the update.
    """
    update_data = item_in.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update data provided",
        )

    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with ID {booking_id} not found",
        )
    item = session.get(BookingItem, item_id)
    if not item or item.booking_id != booking.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking item not found or does not belong to this booking",
        )
    if item.trip_merchandise_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change ticket type for merchandise items",
        )
    if booking.booking_status == BookingStatus.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change ticket type for a checked-in booking",
        )

    new_boat_id = update_data.get("boat_id")
    if new_boat_id is not None and new_boat_id != item.boat_id:
        trip_boats = crud.get_trip_boats_by_trip(
            session=session, trip_id=item.trip_id, limit=100
        )
        boat_ids_on_trip = {tb.boat_id for tb in trip_boats}
        if new_boat_id not in boat_ids_on_trip:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target boat is not on this trip",
            )

    effective_boat_id = new_boat_id if new_boat_id is not None else item.boat_id
    new_item_type = update_data.get("item_type")
    effective_item_type = new_item_type if new_item_type is not None else item.item_type

    if new_item_type is not None or new_boat_id is not None:
        effective = crud.get_effective_pricing(
            session=session,
            trip_id=item.trip_id,
            boat_id=effective_boat_id,
        )
        by_type = {p.ticket_type: p for p in effective}
        if effective_item_type not in by_type:
            boat = session.get(Boat, effective_boat_id)
            boat_name = boat.name if boat else str(effective_boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ticket type '{effective_item_type}' is not available for boat '{boat_name}'. Change ticket type or choose another boat.",
            )
        pricing = by_type[effective_item_type]
        capacities = crud.get_effective_capacity_per_ticket_type(
            session=session,
            trip_id=item.trip_id,
            boat_id=effective_boat_id,
        )
        cap = capacities.get(effective_item_type)
        if cap is not None:
            paid = crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
                session=session, trip_id=item.trip_id
            ).get((effective_boat_id, effective_item_type), 0)
            extra = (
                item.quantity
                if (
                    effective_item_type != item.item_type
                    or effective_boat_id != item.boat_id
                )
                else 0
            )
            total_after = paid + extra
            if total_after > cap:
                boat = session.get(Boat, effective_boat_id)
                boat_name = boat.name if boat else str(effective_boat_id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Boat '{boat_name}' capacity for '{effective_item_type}' would be exceeded",
                )
        update_data["price_per_unit"] = pricing.price
        if new_item_type is not None:
            update_data["item_type"] = new_item_type
        if new_boat_id is not None:
            update_data["boat_id"] = new_boat_id

    crud.update_booking_item(
        session=session, db_obj=item, obj_in=BookingItemUpdate(**update_data)
    )

    items = get_booking_items_in_display_order(session, booking.id)
    new_subtotal = sum(i.price_per_unit * i.quantity for i in items)
    booking.subtotal = new_subtotal
    trip = session.get(Trip, items[0].trip_id) if items else None
    if trip:
        mission = session.get(Mission, trip.mission_id)
        launch = session.get(Launch, mission.launch_id) if mission else None
        tax_rate = None
        if launch is not None:
            jurisdictions = crud.get_jurisdictions_by_location(
                session=session, location_id=launch.location_id, limit=1
            )
            if jurisdictions:
                tax_rate = jurisdictions[0].sales_tax_rate
        if tax_rate is not None:
            new_tax, new_total = compute_booking_totals(
                new_subtotal,
                booking.discount_amount,
                tax_rate,
                booking.tip_amount,
            )
            booking.tax_amount = new_tax
            booking.total_amount = new_total
    session.add(booking)
    session.commit()
    session.refresh(booking)

    updated_items = get_booking_items_in_display_order(session, booking.id)
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [BookingItemPublic.model_validate(i) for i in updated_items]
    return booking_public
