"""
CRUD operations for bookings.

Contains the core booking creation logic extracted from the route layer.
Note: This module currently raises HTTPException for validation errors.
This is a known deviation from the convention in other CRUD modules,
kept to minimize risk during the initial extraction.
"""

import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app import crud
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingStatus,
    DiscountCode,
    Merchandise,
    MerchandiseVariation,
    Mission,
    Trip,
    TripBoat,
    TripMerchandise,
    User,
)

from ..api.routes.booking_utils import (
    generate_qr_code,
)

logger = logging.getLogger(__name__)


def create_booking_impl(
    *,
    session: Session,
    booking_in: BookingCreate,
    current_user: User | None,
) -> Booking:
    """Create a new booking from payload; used by create_booking and duplicate_booking."""
    if not booking_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking must have at least one item",
        )

    # Validate all trips exist and are active, and ensure they all belong to the same mission.
    # Mission-level (not trip-level) allows future multi-trip bookings within a mission
    # (e.g. pre-launch + launch-day trips). UI currently creates single-trip bookings only.
    mission_id = None
    for item in booking_in.items:
        trip = session.get(Trip, item.trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip {item.trip_id} not found",
            )
        if not trip.active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trip {item.trip_id} is not active",
            )

        # Ensure all trips belong to the same mission
        if mission_id is None:
            mission_id = trip.mission_id
        elif trip.mission_id != mission_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All booking items must belong to trips from the same mission",
            )

    # Validate the derived mission exists and is active
    mission = session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )
    if not mission.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mission is not active",
        )

    # Enforce trip booking_mode access control (bypass for authenticated superusers).
    # Apply sales-open bump so stored mode is used.
    now = datetime.now(timezone.utc)
    distinct_trip_ids = {item.trip_id for item in booking_in.items}
    trips_with_modes = [(tid, session.get(Trip, tid)) for tid in distinct_trip_ids]
    for _, t in trips_with_modes:
        if t:
            crud.apply_sales_open_bump_if_needed(
                session=session,
                trip_id=t.id,
                booking_mode=getattr(t, "booking_mode", "private"),
                sales_open_at=getattr(t, "sales_open_at", None),
                now=now,
            )

    any_private = any(t.booking_mode == "private" for _, t in trips_with_modes if t)
    any_early_bird = any(
        t.booking_mode == "early_bird" for _, t in trips_with_modes if t
    )
    logger.info(
        "create_booking access check: mission_id=%s any_private=%s any_early_bird=%s "
        "discount_code_id=%s current_user=%s is_superuser=%s",
        mission_id,
        any_private,
        any_early_bird,
        booking_in.discount_code_id,
        current_user.id if current_user else None,
        current_user.is_superuser if current_user else None,
    )
    if current_user and current_user.is_superuser:
        pass
    elif any_private:
        logger.warning(
            "create_booking 403: at least one trip has booking_mode=private",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for one or more trips",
        )
    elif any_early_bird:
        if not booking_in.discount_code_id:
            logger.warning(
                "create_booking 403: at least one trip is early_bird but discount_code_id is missing",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An access code is required to book one or more trips",
            )
        discount_code = session.get(DiscountCode, booking_in.discount_code_id)
        if not discount_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid access code",
            )
        if not discount_code.is_access_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="A valid access code is required to book one or more trips",
            )
        if not discount_code.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access code is not active",
            )
        if (
            discount_code.access_code_mission_id
            and discount_code.access_code_mission_id != mission_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access code is not valid for this mission",
            )

    # Validate discount code restrictions (trip type, launch, mission, trip) when present
    if booking_in.discount_code_id:
        discount_code = session.get(DiscountCode, booking_in.discount_code_id)
        if discount_code:
            from app.services.discount_restrictions import (
                check_discount_code_restrictions,
            )

            check_discount_code_restrictions(
                session=session,
                discount_code=discount_code,
                trip_ids=list(distinct_trip_ids),
            )

    # Validate all boats exist and are associated with the corresponding trip
    for item in booking_in.items:
        boat = session.get(Boat, item.boat_id)
        if not boat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Boat {item.boat_id} not found",
            )

        # Ensure boat is associated with trip
        association = session.exec(
            select(TripBoat).where(
                (TripBoat.trip_id == item.trip_id) & (TripBoat.boat_id == item.boat_id)
            )
        ).first()
        if association is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Boat {item.boat_id} is not associated with trip {item.trip_id}",
            )
        if not association.sales_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sales are currently disabled for boat '{boat.name}' on this trip",
            )

    # Validate pricing and inventory server-side
    for item in booking_in.items:
        if item.trip_merchandise_id is None:
            # Ticket pricing must match effective pricing for (trip_id, boat_id)
            effective = crud.get_effective_pricing(
                session=session,
                trip_id=item.trip_id,
                boat_id=item.boat_id,
            )
            by_type = {p.ticket_type: p.price for p in effective}
            # Match item_type or with "_ticket" suffix removed for backward compatibility
            price = by_type.get(item.item_type) or by_type.get(
                item.item_type.replace("_ticket", "")
            )
            if price is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No pricing configured for ticket type '{item.item_type}'",
                )
            if price != item.price_per_unit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ticket price mismatch",
                )
        else:
            # Merchandise must reference a valid TripMerchandise row and have inventory
            tm = session.get(TripMerchandise, item.trip_merchandise_id)
            if not tm or tm.trip_id != item.trip_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid merchandise reference",
                )
            m = session.get(Merchandise, tm.merchandise_id)
            if not m:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Merchandise not found",
                )
            variations = crud.list_merchandise_variations_by_merchandise(
                session=session, merchandise_id=m.id
            )
            allowed = (
                [v.variant_value for v in variations if (v.variant_value or "").strip()]
                if variations
                else []
            )
            if allowed:
                if not item.variant_option or item.variant_option not in allowed:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Merchandise '{m.name}' requires a valid variant: "
                            f"one of {allowed}"
                        ),
                    )
            # Resolve variation for per-variant inventory
            variant_value = (item.variant_option or "").strip()
            variation = crud.get_merchandise_variation_by_merchandise_and_value(
                session=session,
                merchandise_id=tm.merchandise_id,
                variant_value=variant_value,
            )
            if not variation:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Merchandise '{m.name}' has no variation for "
                        f"variant '{variant_value or '(none)'}'"
                    ),
                )
            available = variation.quantity_total - variation.quantity_sold
            if tm.quantity_available_override is not None:
                available = min(available, tm.quantity_available_override)
            effective_price = (
                tm.price_override if tm.price_override is not None else m.price
            )
            if available < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient merchandise inventory",
                )
            if effective_price != item.price_per_unit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Merchandise price mismatch",
                )

    # Validate per-ticket-type capacity: for each (trip_id, boat_id, item_type) check capacity
    ticket_quantity_by_trip_boat_type: dict[
        tuple[uuid.UUID, uuid.UUID, str], int
    ] = defaultdict(int)
    for item in booking_in.items:
        if item.trip_merchandise_id is None:
            ticket_quantity_by_trip_boat_type[
                (item.trip_id, item.boat_id, item.item_type)
            ] += item.quantity
    trip_ids = {i.trip_id for i in booking_in.items if i.trip_merchandise_id is None}
    paid_by_trip: dict[uuid.UUID, dict[tuple[uuid.UUID, str], int]] = {
        tid: crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
            session=session, trip_id=tid
        )
        for tid in trip_ids
    }
    held_by_trip: dict[uuid.UUID, dict[tuple[uuid.UUID, str], int]] = {
        tid: crud.get_held_ticket_count_per_boat_per_item_type_for_trip(
            session=session, trip_id=tid, exclude_booking_id=None
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

    # Validate total boat capacity: sum of all ticket types must not exceed boat's max_capacity
    ticket_quantity_by_trip_boat: dict[tuple[uuid.UUID, uuid.UUID], int] = defaultdict(
        int
    )
    for item in booking_in.items:
        if item.trip_merchandise_id is None:
            ticket_quantity_by_trip_boat[(item.trip_id, item.boat_id)] += item.quantity

    # Get total paid counts per boat (across all ticket types)
    paid_total_by_trip: dict[uuid.UUID, dict[uuid.UUID, int]] = {
        tid: crud.get_paid_ticket_count_per_boat_for_trip(session=session, trip_id=tid)
        for tid in trip_ids
    }
    held_total_by_trip: dict[uuid.UUID, dict[uuid.UUID, int]] = {
        tid: crud.get_held_ticket_count_per_boat_for_trip(
            session=session, trip_id=tid, exclude_booking_id=None
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
            continue  # Already validated above
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

    # Use the confirmation code provided by the frontend
    confirmation_code = booking_in.confirmation_code

    # Verify the confirmation code is unique
    existing = session.exec(
        select(Booking).where(Booking.confirmation_code == confirmation_code)
    ).one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation code already exists. Please try again.",
        )

    # Create booking as draft (no PaymentIntent yet)
    booking = Booking(
        confirmation_code=confirmation_code,
        first_name=booking_in.first_name,
        last_name=booking_in.last_name,
        user_email=booking_in.user_email,
        user_phone=booking_in.user_phone,
        billing_address=booking_in.billing_address,
        subtotal=booking_in.subtotal,
        discount_amount=booking_in.discount_amount,
        tax_amount=booking_in.tax_amount,
        tip_amount=booking_in.tip_amount,
        total_amount=booking_in.total_amount,
        payment_intent_id=None,
        special_requests=booking_in.special_requests,
        admin_notes=booking_in.admin_notes,
        booking_status=BookingStatus.draft,
        payment_status=None,
        launch_updates_pref=booking_in.launch_updates_pref,
        discount_code_id=booking_in.discount_code_id,
    )

    # Create booking items (resolve variation for merchandise to set merchandise_variation_id)
    booking_items = []
    for item in booking_in.items:
        variation_id = None
        if item.trip_merchandise_id:
            tm = session.get(TripMerchandise, item.trip_merchandise_id)
            if tm:
                variation = crud.get_merchandise_variation_by_merchandise_and_value(
                    session=session,
                    merchandise_id=tm.merchandise_id,
                    variant_value=(item.variant_option or "").strip(),
                )
                if variation:
                    variation_id = variation.id
        booking_item = BookingItem(
            booking=booking,
            trip_id=item.trip_id,
            boat_id=item.boat_id,
            trip_merchandise_id=item.trip_merchandise_id,
            merchandise_variation_id=variation_id,
            item_type=item.item_type,
            quantity=item.quantity,
            price_per_unit=item.price_per_unit,
            status=item.status,
            refund_reason=item.refund_reason,
            refund_notes=item.refund_notes,
            variant_option=item.variant_option,
        )
        booking_items.append(booking_item)

    # Add all items to session
    session.add(booking)
    for item in booking_items:
        session.add(item)

    # Commit to get IDs
    session.commit()
    session.refresh(booking)

    # Update variation quantity_sold for merchandise items
    try:
        for item in booking_items:
            if item.merchandise_variation_id:
                variation = session.get(
                    MerchandiseVariation, item.merchandise_variation_id
                )
                if variation:
                    variation.quantity_sold += item.quantity
                    session.add(variation)
        session.commit()
    except Exception:
        session.rollback()
        raise

    # Generate QR code
    booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)

    # Update booking with QR code
    session.add(booking)
    session.commit()
    session.refresh(booking)
    booking.items = booking_items
    return booking
