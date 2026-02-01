import logging
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app import crud
from app.api import deps
from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingItemCreate,
    BookingItemPublic,
    BookingItemQuantityUpdate,
    BookingItemStatus,
    BookingPublic,
    BookingStatus,
    BookingUpdate,
    DiscountCode,
    Merchandise,
    Mission,
    Trip,
    TripBoat,
    TripMerchandise,
    User,
)
from app.services.date_validator import is_booking_past, is_trip_past
from app.utils import (
    generate_booking_cancelled_email,
    generate_booking_confirmation_email,
    generate_booking_refunded_email,
    send_email,
)

from .booking_utils import (
    generate_qr_code,
    generate_unique_confirmation_code,
    get_booking_with_items,
    get_mission_name_for_booking,
    prepare_booking_items_for_email,
    validate_confirmation_code,
)

# Set up logging
logger = logging.getLogger(__name__)


# Paginated response model
class BookingsPaginatedResponse(BaseModel):
    data: list[BookingPublic]
    total: int
    page: int
    per_page: int
    total_pages: int


router = APIRouter(prefix="/bookings", tags=["bookings"])


def _create_booking_impl(
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

    # Validate all trips exist and are active, and ensure they all belong to the same mission
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

        # Validate trip has not already departed
        if is_trip_past(trip):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot create booking: Trip {item.trip_id} has already departed",
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

    # Enforce booking_mode access control (bypass for authenticated superusers)
    logger.info(
        "create_booking access check: mission_id=%s booking_mode=%s discount_code_id=%s "
        "current_user=%s is_superuser=%s",
        mission_id,
        mission.booking_mode,
        booking_in.discount_code_id,
        current_user.id if current_user else None,
        current_user.is_superuser if current_user else None,
    )
    if current_user and current_user.is_superuser:
        # Superusers can create bookings regardless of booking_mode
        pass
    elif mission.booking_mode == "private":
        logger.warning(
            "create_booking 403: mission %s has booking_mode=private",
            mission_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for this mission",
        )
    elif mission.booking_mode == "early_bird":
        # Require a valid access code (passed via discount_code_id)
        if not booking_in.discount_code_id:
            logger.warning(
                "create_booking 403: mission %s early_bird but discount_code_id is missing",
                mission_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An access code is required to book this mission",
            )
        # Validate that the discount code is a valid access code
        discount_code = session.get(DiscountCode, booking_in.discount_code_id)
        if not discount_code:
            logger.warning(
                "create_booking 400: discount_code_id %s not found",
                booking_in.discount_code_id,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid access code",
            )
        if not discount_code.is_access_code:
            logger.warning(
                "create_booking 403: discount_code_id %s is not an access code",
                booking_in.discount_code_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="A valid access code is required to book this mission",
            )
        if not discount_code.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Access code is not active",
            )
        # Check if access code is restricted to a specific mission
        if (
            discount_code.access_code_mission_id
            and discount_code.access_code_mission_id != mission_id
        ):
            logger.warning(
                "create_booking 403: access code mission %s != booking mission %s",
                discount_code.access_code_mission_id,
                mission_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access code is not valid for this mission",
            )
    # booking_mode == "public" allows all bookings

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

    # Validate pricing and inventory server-side
    for item in booking_in.items:
        # Check if this is a ticket item (not merchandise)
        # Tickets don't have trip_merchandise_id, merchandise items do
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
            effective_qty = (
                tm.quantity_available_override
                if tm.quantity_available_override is not None
                else m.quantity_available
            )
            effective_price = (
                tm.price_override if tm.price_override is not None else m.price
            )
            if effective_qty < item.quantity:
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
    for (
        trip_id,
        boat_id,
        item_type,
    ), new_quantity in ticket_quantity_by_trip_boat_type.items():
        capacities = crud.get_effective_capacity_per_ticket_type(
            session=session, trip_id=trip_id, boat_id=boat_id
        )
        capacity = capacities.get(item_type)
        if capacity is None:
            boat = session.get(Boat, boat_id)
            boat_name = boat.name if boat else str(boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"No capacity configured for ticket type '{item_type}' on boat '{boat_name}'"
                ),
            )
        paid_by_type = paid_by_trip.get(trip_id, {})
        paid = paid_by_type.get((boat_id, item_type), 0)
        total_after = paid + new_quantity
        if total_after > capacity:
            boat = session.get(Boat, boat_id)
            boat_name = boat.name if boat else str(boat_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Boat '{boat_name}' has {capacity} seat(s) for '{item_type}' "
                    f"with {paid} already booked; requested {new_quantity} would exceed capacity"
                ),
            )

    # Don't create PaymentIntent yet - booking starts as draft

    # Use the confirmation code provided by the frontend
    confirmation_code = booking_in.confirmation_code

    # Verify the confirmation code is unique
    existing = (
        session.query(Booking)
        .filter(Booking.confirmation_code == confirmation_code)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation code already exists. Please try again.",
        )

    # Determine booking status
    # If superuser and status is provided, use it (for admin bookings marked as paid)
    # Otherwise, start as draft
    initial_status = BookingStatus.draft
    if current_user and current_user.is_superuser:
        # Check if status was provided in booking_in (via model field if added)
        # For now, we'll default to draft but allow update after creation
        # Status can be set via update endpoint after creation
        pass

    # Create booking as draft (no PaymentIntent yet)
    # Superusers can update status to "confirmed" after creation via update endpoint
    booking = Booking(
        confirmation_code=confirmation_code,
        user_name=booking_in.user_name,
        user_email=booking_in.user_email,
        user_phone=booking_in.user_phone,
        billing_address=booking_in.billing_address,
        subtotal=booking_in.subtotal,
        discount_amount=booking_in.discount_amount,
        tax_amount=booking_in.tax_amount,
        tip_amount=booking_in.tip_amount,
        total_amount=booking_in.total_amount,
        payment_intent_id=None,  # No PaymentIntent yet
        special_requests=booking_in.special_requests,
        status=initial_status,  # Start as draft (can be updated to confirmed for admin)
        launch_updates_pref=booking_in.launch_updates_pref,
        discount_code_id=booking_in.discount_code_id,
    )

    # Create booking items
    booking_items = []
    for item in booking_in.items:
        booking_item = BookingItem(
            booking=booking,
            trip_id=item.trip_id,
            boat_id=item.boat_id,
            trip_merchandise_id=item.trip_merchandise_id,
            item_type=item.item_type,
            quantity=item.quantity,
            price_per_unit=item.price_per_unit,
            status=item.status,
            refund_reason=item.refund_reason,
            refund_notes=item.refund_notes,
        )
        booking_items.append(booking_item)

    # Add all items to session
    session.add(booking)
    for item in booking_items:
        session.add(item)

    # Commit to get IDs and atomically decrement inventory
    session.commit()
    session.refresh(booking)

    # Decrement catalog inventory for merchandise items
    try:
        for item in booking_items:
            if item.trip_merchandise_id:
                tm = session.get(TripMerchandise, item.trip_merchandise_id)
                if tm:
                    m = session.get(Merchandise, tm.merchandise_id)
                    if m:
                        m.quantity_available = max(
                            0, m.quantity_available - item.quantity
                        )
                        session.add(m)
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


# --- Public Endpoints ---


@router.post("/", response_model=BookingPublic, status_code=status.HTTP_201_CREATED)
def create_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_in: BookingCreate,
    current_user: User | None = Depends(deps.get_optional_current_user),
) -> BookingPublic:
    """
    Create new booking (authentication optional - public or admin).
    """
    return _create_booking_impl(
        session=session,
        booking_in=booking_in,
        current_user=current_user,
    )


@router.post(
    "/id/{booking_id}/duplicate",
    response_model=BookingPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def duplicate_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> BookingPublic:
    """
    Duplicate a booking as a new draft (admin only).
    Copies customer data and items; new booking has status draft and a new confirmation code.
    """
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} not found",
        )
    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking has no items to duplicate",
        )
    confirmation_code = generate_unique_confirmation_code(session)
    booking_in = BookingCreate(
        confirmation_code=confirmation_code,
        user_name=booking.user_name,
        user_email=booking.user_email,
        user_phone=booking.user_phone,
        billing_address=booking.billing_address,
        subtotal=booking.subtotal,
        discount_amount=booking.discount_amount,
        tax_amount=booking.tax_amount,
        tip_amount=booking.tip_amount,
        total_amount=booking.total_amount,
        special_requests=booking.special_requests,
        launch_updates_pref=booking.launch_updates_pref,
        discount_code_id=booking.discount_code_id,
        items=[
            BookingItemCreate(
                trip_id=item.trip_id,
                boat_id=item.boat_id,
                trip_merchandise_id=item.trip_merchandise_id,
                item_type=item.item_type,
                quantity=item.quantity,
                price_per_unit=item.price_per_unit,
                status=BookingItemStatus.active,
                refund_reason=None,
                refund_notes=None,
            )
            for item in items
        ],
    )
    created = _create_booking_impl(
        session=session,
        booking_in=booking_in,
        current_user=current_user,
    )
    # Ensure items are on the response for the client
    created_items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == created.id)
    ).all()
    booking_public = BookingPublic.model_validate(created)
    booking_public.items = [BookingItemPublic.model_validate(i) for i in created_items]
    return booking_public


# --- Admin-Restricted Endpoints (use dependency for access control) ---


@router.get(
    "/",
    response_model=BookingsPaginatedResponse,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def list_bookings(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    mission_id: uuid.UUID | None = None,
    trip_id: uuid.UUID | None = None,
    status: str | None = None,
    sort_by: str = "created_at",
    sort_direction: str = "desc",
) -> BookingsPaginatedResponse:
    """
    List/search bookings (admin only).
    Optionally filter by mission_id, trip_id, or status.
    """
    try:
        # Parameter validation
        if skip < 0:
            logger.warning(f"Negative skip parameter provided: {skip}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Skip parameter cannot be negative",
            )

        if limit <= 0:
            logger.warning(f"Invalid limit parameter provided: {limit}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit parameter must be positive",
            )

        if limit > 500:
            logger.info(f"Limit parameter reduced from {limit} to 500")
            limit = 500  # Cap at 500 to prevent excessive queries

        # Build base query
        base_query = select(Booking)

        # Apply mission/trip filter if provided (join via BookingItem, optionally Trip)
        if mission_id or trip_id:
            base_query = base_query.join(
                BookingItem, BookingItem.booking_id == Booking.id
            )
            if mission_id:
                base_query = base_query.join(
                    Trip, Trip.id == BookingItem.trip_id
                ).where(Trip.mission_id == mission_id)
            if trip_id:
                base_query = base_query.where(BookingItem.trip_id == trip_id)
            base_query = base_query.distinct()
            if mission_id:
                logger.info(f"Filtering bookings by mission_id: {mission_id}")
            if trip_id:
                logger.info(f"Filtering bookings by trip_id: {trip_id}")

        # Apply status filter if provided
        if status:
            base_query = base_query.where(Booking.status == status)
            logger.info(f"Filtering bookings by status: {status}")

        # Get total count first
        total_count = 0
        try:
            count_query = select(func.count(Booking.id.distinct()))
            if mission_id or trip_id:
                count_query = count_query.select_from(Booking).join(
                    BookingItem, BookingItem.booking_id == Booking.id
                )
                if mission_id:
                    count_query = count_query.join(
                        Trip, Trip.id == BookingItem.trip_id
                    ).where(Trip.mission_id == mission_id)
                if trip_id:
                    count_query = count_query.where(BookingItem.trip_id == trip_id)
            if status:
                if not (mission_id or trip_id):
                    count_query = count_query.select_from(Booking)
                count_query = count_query.where(Booking.status == status)
            total_count = session.exec(count_query).first()
            logger.info(f"Total bookings count: {total_count}")
        except Exception as e:
            logger.error(f"Error counting bookings: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error counting bookings",
            )

        # Apply sorting
        sort_column = getattr(Booking, sort_by, Booking.created_at)
        if sort_direction.lower() == "asc":
            order_clause = sort_column.asc()
        else:
            order_clause = sort_column.desc()

        # Fetch bookings with sorting
        bookings = []
        try:
            bookings = session.exec(
                base_query.order_by(order_clause).offset(skip).limit(limit)
            ).all()
            logger.info(
                f"Retrieved {len(bookings)} bookings (skip={skip}, limit={limit}, sort_by={sort_by}, sort_direction={sort_direction})"
            )
        except Exception as e:
            logger.error(f"Database error in list_bookings: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error retrieving bookings from database",
            )

        result = []
        qr_code_updates = []

        # Process each booking
        for booking in bookings:
            try:
                # Fetch items for this booking
                items = session.exec(
                    select(BookingItem).where(BookingItem.booking_id == booking.id)
                ).all()

                booking_public = BookingPublic.model_validate(booking)
                booking_public.items = [
                    BookingItemPublic.model_validate(item) for item in items
                ]

                # Get mission information from first booking item
                if items and len(items) > 0:
                    trip = session.get(Trip, items[0].trip_id)
                    if trip:
                        booking_public.mission_id = trip.mission_id
                        mission = session.get(Mission, trip.mission_id)
                        if mission:
                            booking_public.mission_name = mission.name

                # Flag bookings missing QR codes for batch update
                if not booking.qr_code_base64:
                    qr_code_updates.append(booking)

                result.append(booking_public)

            except Exception as e:
                # Log error but continue processing other bookings
                logger.error(f"Error processing booking {booking.id}: {str(e)}")
                continue

        # Batch update QR codes if needed
        if qr_code_updates:
            logger.info(
                f"Generating missing QR codes for {len(qr_code_updates)} bookings"
            )
            try:
                for booking in qr_code_updates:
                    booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
                    session.add(booking)
                session.commit()
            except Exception as e:
                logger.error(f"Error generating QR codes: {str(e)}")
                # Continue even if QR code generation fails
                session.rollback()

        # Return both data and total count for pagination
        return BookingsPaginatedResponse(
            data=result,
            total=total_count,
            page=(skip // limit) + 1,
            per_page=limit,
            total_pages=(total_count + limit - 1) // limit,  # Ceiling division
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error in list_bookings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


@router.get(
    "/id/{booking_id}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def get_booking_by_id(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
) -> BookingPublic:
    """
    Retrieve booking details by ID (admin only).
    """
    try:
        # Fetch booking
        booking = session.get(Booking, booking_id)
        if not booking:
            logger.info(f"Booking not found with ID: {booking_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID {booking_id} not found",
            )

        # Fetch items separately with error handling
        items = []
        try:
            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()

            if not items:
                logger.warning(f"Booking {booking_id} has no items")
        except Exception as e:
            logger.error(f"Error retrieving items for booking {booking_id}: {str(e)}")
            # Continue without items rather than failing completely

        # Prepare response
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in items
        ]

        # Handle QR code generation
        if not booking.qr_code_base64:
            try:
                logger.info(f"Generating missing QR code for booking: {booking.id}")
                booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
                session.add(booking)
                session.commit()
            except Exception as e:
                logger.error(
                    f"Failed to generate QR code for booking {booking.id}: {str(e)}"
                )
                # Continue even if QR code generation fails
                session.rollback()

        return booking_public

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error retrieving booking {booking_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


@router.patch(
    "/id/{booking_id}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def update_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    booking_in: BookingUpdate,
) -> BookingPublic:
    """
    Update booking status or details (admin only).
    """
    try:
        # Validate input data
        update_data = booking_in.model_dump(exclude_unset=True)
        if not update_data:
            logger.warning(f"Empty update request for booking {booking_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided",
            )

        # Fetch the booking
        booking = session.get(Booking, booking_id)
        if not booking:
            logger.warning(f"Attempt to update non-existent booking: {booking_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID {booking_id} not found",
            )

        # Check if booking's trip is in the past and prevent editing unless override is allowed
        # Note: allow_past_edit parameter would need to be added to the function signature
        # For now, we'll check but allow superusers to edit (they have access to this endpoint)
        if is_booking_past(booking, session):
            # Allow superusers to edit past bookings (for refunds, corrections)
            # This endpoint already requires superuser authentication
            logger.info(
                f"Updating booking {booking_id} for a trip that has already departed (superuser override)"
            )

        # 1. Enforce business rules
        # Disallow updates to items (raw) via PATCH; item_quantity_updates handled below
        forbidden_fields = {
            "items",
            "confirmation_code",
            "mission_id",
            "payment_intent_id",
        }
        invalid_fields = [f for f in forbidden_fields if f in update_data]
        if invalid_fields:
            logger.warning(
                f"Attempt to update forbidden fields: {', '.join(invalid_fields)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update these fields via PATCH: {', '.join(invalid_fields)}",
            )

        # Process item quantity updates (draft/pending_payment only)
        item_quantity_updates: list[BookingItemQuantityUpdate] | None = update_data.pop(
            "item_quantity_updates", None
        )
        if item_quantity_updates:
            if booking.status not in (
                BookingStatus.draft,
                BookingStatus.pending_payment,
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Item quantities can only be updated for draft or pending_payment bookings",
                )
            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()
            qty_by_id = {u.id: u.quantity for u in item_quantity_updates}
            for u in item_quantity_updates:
                item = session.get(BookingItem, u.id)
                if not item or item.booking_id != booking.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Booking item {u.id} not found or does not belong to this booking",
                    )
            # Validate ticket capacity with proposed quantities
            ticket_totals: dict[tuple[uuid.UUID, uuid.UUID, str], int] = defaultdict(
                int
            )
            for item in items:
                if item.trip_merchandise_id is None:
                    qty = qty_by_id.get(item.id, item.quantity)
                    ticket_totals[(item.trip_id, item.boat_id, item.item_type)] += qty
            for (trip_id, boat_id, item_type), qty in ticket_totals.items():
                capacities = crud.get_effective_capacity_per_ticket_type(
                    session=session, trip_id=trip_id, boat_id=boat_id
                )
                cap = capacities.get(item_type)
                if cap is None:
                    boat = session.get(Boat, boat_id)
                    boat_name = boat.name if boat else str(boat_id)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No capacity for ticket type '{item_type}' on boat '{boat_name}'",
                    )
                paid = crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
                    session=session, trip_id=trip_id
                ).get((boat_id, item_type), 0)
                if paid + qty > cap:
                    boat = session.get(Boat, boat_id)
                    boat_name = boat.name if boat else str(boat_id)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Boat '{boat_name}' capacity for '{item_type}' would be exceeded",
                    )
            # Apply quantity updates and merchandise inventory
            for u in item_quantity_updates:
                item = session.get(BookingItem, u.id)
                if not item:
                    continue
                old_qty = item.quantity
                new_qty = u.quantity
                if new_qty == old_qty:
                    continue
                if item.trip_merchandise_id:
                    tm = session.get(TripMerchandise, item.trip_merchandise_id)
                    if tm:
                        m = session.get(Merchandise, tm.merchandise_id)
                        if m:
                            delta = new_qty - old_qty
                            if delta > 0:
                                if m.quantity_available < delta:
                                    raise HTTPException(
                                        status_code=status.HTTP_400_BAD_REQUEST,
                                        detail=f"Insufficient merchandise inventory for item {item.item_type}",
                                    )
                                m.quantity_available -= delta
                            else:
                                m.quantity_available += abs(delta)
                            session.add(m)
                item.quantity = new_qty
                session.add(item)
            # Recompute booking subtotal
            new_subtotal = sum(
                (qty_by_id.get(item.id, item.quantity) * item.price_per_unit)
                for item in items
            )
            booking.subtotal = new_subtotal
            session.add(booking)

        # Validate status transitions
        status_changed = False
        new_status = None
        old_status = booking.status

        if "status" in update_data:
            new_status = update_data["status"]
            if new_status != old_status:
                status_changed = True

            # Define valid status transitions
            valid_transitions = {
                "draft": [
                    "confirmed",
                    "cancelled",
                ],  # Allow draft -> confirmed for admin bookings
                "pending_payment": ["confirmed", "cancelled", "completed"],
                "confirmed": ["checked_in", "cancelled", "refunded"],
                "checked_in": ["completed", "refunded"],
                "completed": ["refunded"],
                "cancelled": [],  # Terminal state
                "refunded": [],  # Terminal state
            }

            if new_status not in valid_transitions.get(old_status, []):
                logger.warning(
                    f"Invalid status transition for booking {booking_id}: "
                    f"{old_status} -> {new_status}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot transition from '{old_status}' to '{new_status}'",
                )

        # Tip must be non-negative
        if "tip_amount" in update_data and update_data["tip_amount"] is not None:
            if update_data["tip_amount"] < 0:
                logger.warning(
                    f"Negative tip amount in update: {update_data['tip_amount']}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tip amount cannot be negative",
                )

        # If status is being updated to cancelled or refunded, update BookingItems
        if "status" in update_data:
            new_status = update_data["status"]
            if new_status in ("cancelled", "refunded"):
                try:
                    items = session.exec(
                        select(BookingItem).where(BookingItem.booking_id == booking.id)
                    ).all()

                    if not items:
                        logger.warning(
                            f"No items found for booking {booking_id} during status update"
                        )

                    for item in items:
                        item.status = (
                            "refunded" if new_status == "refunded" else "active"
                        )
                        session.add(item)
                except Exception as e:
                    logger.error(
                        f"Error updating booking items for {booking_id}: {str(e)}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update booking items status",
                    )

        # Only update allowed fields
        allowed_fields = {
            "status",
            "special_requests",
            "tip_amount",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "launch_updates_pref",
            "user_name",
            "user_email",
            "user_phone",
            "billing_address",
        }

        # Check for any fields that are not allowed
        invalid_fields = [f for f in update_data.keys() if f not in allowed_fields]
        if invalid_fields:
            logger.warning(
                f"Attempt to update invalid fields: {', '.join(invalid_fields)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fields not allowed for update: {', '.join(invalid_fields)}",
            )

        # Apply updates to allowed fields
        for field, value in update_data.items():
            setattr(booking, field, value)

        try:
            session.add(booking)
            session.commit()
            session.refresh(booking)
            logger.info(f"Successfully updated booking {booking_id}")

            # Send email notifications if status changed to cancelled or refunded
            if (
                status_changed
                and settings.emails_enabled
                and new_status in ("cancelled", "refunded")
            ):
                try:
                    # Get mission name
                    mission = session.get(Mission, booking.mission_id)
                    mission_name = mission.name if mission else "Unknown Mission"

                    if new_status == "cancelled":
                        # Send cancellation email
                        email_data = generate_booking_cancelled_email(
                            email_to=booking.user_email,
                            user_name=booking.user_name,
                            confirmation_code=booking.confirmation_code,
                            mission_name=mission_name,
                        )

                        send_email(
                            email_to=booking.user_email,
                            subject=email_data.subject,
                            html_content=email_data.html_content,
                        )

                        logger.info(
                            f"Booking cancellation email sent to {booking.user_email}"
                        )

                    elif new_status == "refunded":
                        # Send refund confirmation email
                        email_data = generate_booking_refunded_email(
                            email_to=booking.user_email,
                            user_name=booking.user_name,
                            confirmation_code=booking.confirmation_code,
                            mission_name=mission_name,
                            refund_amount=booking.total_amount
                            / 100.0,  # cents to dollars for display
                        )

                        send_email(
                            email_to=booking.user_email,
                            subject=email_data.subject,
                            html_content=email_data.html_content,
                        )

                        logger.info(
                            f"Booking refund email sent to {booking.user_email}"
                        )

                except Exception as e:
                    # Don't fail the booking update if email sending fails
                    logger.error(
                        f"Failed to send booking status update email: {str(e)}"
                    )

            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()
            booking_public = BookingPublic.model_validate(booking)
            booking_public.items = [
                BookingItemPublic.model_validate(item) for item in items
            ]

            # Generate QR code if it doesn't exist
            if not booking.qr_code_base64:
                try:
                    booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
                    session.add(booking)
                    session.commit()
                except Exception as e:
                    logger.error(
                        f"Failed to generate QR code for booking {booking.id}: {str(e)}"
                    )
                    # Continue even if QR code generation fails
                    session.rollback()

            return booking_public

        except Exception as e:
            session.rollback()
            logger.error(f"Database error during booking update: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while updating the booking",
            )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error updating booking {booking_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


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
        # Validate confirmation code format
        validate_confirmation_code(confirmation_code)

        # Fetch booking with items
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

        # Validate booking status
        if booking.status not in [BookingStatus.confirmed, BookingStatus.checked_in]:
            logger.warning(
                f"Invalid booking status for check-in: {booking.status} (confirmation: {confirmation_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot check in booking with status '{booking.status}'. Booking must be 'confirmed'.",
            )

        # If trip_id and boat_id are provided, validate against booking items
        if trip_id and boat_id:
            # Find matching booking item
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

        # Update booking status to checked_in
        booking.status = BookingStatus.checked_in
        session.add(booking)

        # Update all booking items to fulfilled status
        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

        for item in items:
            item.status = BookingItemStatus.fulfilled
            session.add(item)

        # Commit all changes
        session.commit()
        session.refresh(booking)

        # Fetch updated items for response
        updated_items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

        # Build response
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in updated_items
        ]

        logger.info(f"Successfully checked in booking {confirmation_code}")
        return booking_public

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        session.rollback()
        logger.exception(
            f"Unexpected error during check-in for {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during check-in. Please try again later.",
        )


@router.post(
    "/{confirmation_code}/resend-email",
    operation_id="bookings_resend_booking_confirmation_email",
)
def resend_booking_confirmation_email(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> dict:
    """
    Resend booking confirmation email.

    Available for both admin and public use.

    Args:
        confirmation_code: The booking confirmation code

    Returns:
        dict: Status of the email sending
    """
    try:
        # Validate confirmation code format
        validate_confirmation_code(confirmation_code)

        # Get booking with items
        booking = get_booking_with_items(
            session, confirmation_code, include_qr_generation=False
        )

        # Only send emails for confirmed bookings
        if booking.status not in [
            BookingStatus.confirmed,
            BookingStatus.checked_in,
            BookingStatus.completed,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only resend emails for confirmed bookings",
            )

        # Check if emails are enabled
        if not settings.emails_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email service is not available",
            )

        # Get mission name and prepare booking items
        mission_name = get_mission_name_for_booking(session, booking)
        booking_items = prepare_booking_items_for_email(booking)
        qr_code_base64 = booking.qr_code_base64 or generate_qr_code(
            booking.confirmation_code
        )

        # Generate and send the email
        email_data = generate_booking_confirmation_email(
            email_to=booking.user_email,
            user_name=booking.user_name,
            confirmation_code=booking.confirmation_code,
            mission_name=mission_name,
            booking_items=booking_items,
            total_amount=booking.total_amount / 100.0,  # cents to dollars for display
            qr_code_base64=qr_code_base64,
        )

        send_email(
            email_to=booking.user_email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )

        return {"status": "success", "message": "Confirmation email sent successfully"}

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the error and return a generic error response
        logger.error(
            f"Failed to resend booking confirmation email for {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send confirmation email. Please try again later.",
        )


@router.post(
    "/refund/{confirmation_code}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def process_refund(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
    refund_reason: str,
    refund_notes: str | None = None,
    refund_amount_cents: int | None = None,
) -> BookingPublic:
    """
    Process a refund for a booking.

    refund_amount_cents: Amount to refund in cents. If None, refunds full booking total.
    Validates the booking and processes the refund through Stripe,
    then updates the booking status to 'refunded'.
    """
    try:
        # Validate confirmation code format
        validate_confirmation_code(confirmation_code)

        # Fetch booking with items
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

        # Validate booking status
        if booking.status not in [
            BookingStatus.confirmed,
            BookingStatus.checked_in,
            BookingStatus.completed,
        ]:
            logger.warning(
                f"Invalid booking status for refund: {booking.status} (confirmation: {confirmation_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot refund booking with status '{booking.status}'. Booking must be 'confirmed', 'checked_in', or 'completed'.",
            )

        # Validate refund amount (all in cents)
        amount_to_refund = (
            refund_amount_cents
            if refund_amount_cents is not None
            else booking.total_amount
        )
        if (
            refund_amount_cents is not None
            and refund_amount_cents > booking.total_amount
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount cannot exceed the total booking amount",
            )

        # Process Stripe refund if payment intent exists
        if booking.payment_intent_id:
            try:
                from app.core.stripe import refund_payment

                stripe_amount = amount_to_refund  # already cents
                refund = refund_payment(booking.payment_intent_id, stripe_amount)

                logger.info(
                    f"Stripe refund processed: {refund.id} for booking {confirmation_code}"
                )
            except Exception as e:
                logger.error(
                    f"Stripe refund failed for booking {confirmation_code}: {str(e)}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to process Stripe refund: {str(e)}",
                )
        else:
            logger.warning(
                f"No payment intent found for booking {confirmation_code}, processing refund without Stripe"
            )

        # Update booking status to refunded
        booking.status = BookingStatus.refunded
        session.add(booking)

        # Update all booking items to refunded status with reason and notes
        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

        for item in items:
            item.status = BookingItemStatus.refunded
            item.refund_reason = refund_reason
            item.refund_notes = refund_notes
            session.add(item)

        # Commit all changes
        session.commit()
        session.refresh(booking)

        # Send refund confirmation email
        try:
            from app.utils import generate_booking_refunded_email

            # Get mission name
            mission = session.get(Mission, booking.mission_id)
            mission_name = mission.name if mission else "Unknown Mission"

            email_data = generate_booking_refunded_email(
                email_to=booking.user_email,
                user_name=booking.user_name,
                confirmation_code=booking.confirmation_code,
                mission_name=mission_name,
                refund_amount=amount_to_refund / 100.0,  # cents to dollars for display
            )

            send_email(
                email_to=booking.user_email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )

            logger.info(f"Refund confirmation email sent to {booking.user_email}")
        except Exception as e:
            logger.error(
                f"Failed to send refund email for booking {confirmation_code}: {str(e)}"
            )
            # Don't fail the refund if email sending fails

        # Fetch updated items for response
        updated_items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

        # Build response
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in updated_items
        ]

        logger.info(f"Successfully processed refund for booking {confirmation_code}")
        return booking_public

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        session.rollback()
        logger.exception(
            f"Unexpected error during refund processing for {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during refund processing. Please try again later.",
        )


@router.get(
    "/export/csv",
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def export_bookings_csv(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: str | None = None,
    trip_id: str | None = None,
    booking_status: str | None = None,
    fields: str | None = None,  # Comma-separated list of field names
) -> Response:
    """
    Export bookings data to CSV format.

    Supports filtering by mission_id, trip_id, and booking_status.
    Supports field selection via the fields parameter (comma-separated list of field names).
    Available fields: confirmation_code, customer_name, email, phone, billing_address,
    status, total_amount, subtotal, discount_amount, tax_amount, tip_amount, created_at,
    trip_type, boat_name; ticket_types (or ticket_types_quantity, ticket_types_price,
    ticket_types_total); swag (or swag_description, swag_total).

    When ticket-type columns are requested (ticket_types, ticket_types_quantity, etc.),
    trip_id should be provided. The ticket-type columns will be derived from that trip's
    effective pricing (BoatPricing + TripBoatPricing across boats on the trip).
    Booking items will be matched to the trip's ticket types (with backward compatibility
    for legacy naming variants like "adult" vs "adult_ticket").
    """
    try:
        import csv
        import io

        from fastapi.responses import Response

        # Build query
        query = select(Booking)

        # Apply filters
        conditions = []

        if mission_id or trip_id:
            # Join with BookingItem if we need to filter by mission or trip
            query = query.join(BookingItem)

            if mission_id:
                conditions.append(BookingItem.trip.has(Trip.mission_id == mission_id))
            if trip_id:
                conditions.append(BookingItem.trip_id == trip_id)

        if booking_status:
            conditions.append(Booking.status == booking_status)

        # Apply all conditions
        if conditions:
            query = query.where(*conditions)

        # Execute query
        bookings = session.exec(query).all()

        # Check if ticket-type columns are requested
        will_include_ticket_types = (
            fields
            and any(
                f in fields.split(",")
                for f in [
                    "ticket_types",
                    "ticket_types_quantity",
                    "ticket_types_price",
                    "ticket_types_total",
                ]
            )
            or (not fields)
        )  # Default includes ticket_types

        # Determine ticket types: from effective pricing if trip_id provided, else from booking items
        if trip_id and will_include_ticket_types:
            sorted_ticket_types = crud.get_effective_ticket_types_for_trip(
                session=session, trip_id=trip_id
            )
        else:
            # Fallback: collect from booking items (for exports without trip selection)
            def normalize_ticket_type(raw: str) -> str:
                """Normalize ticket type names: remove '_ticket' suffix to merge legacy variants."""
                if raw.endswith("_ticket"):
                    return raw[:-7]
                return raw

            all_ticket_types: set[str] = set()
            for booking in bookings:
                items = session.exec(
                    select(BookingItem).where(BookingItem.booking_id == booking.id)
                ).all()
                for item in items:
                    if item.trip_merchandise_id is None:
                        all_ticket_types.add(normalize_ticket_type(item.item_type))
            sorted_ticket_types = sorted(all_ticket_types)

        def match_item_to_ticket_type(
            item_type: str, trip_ticket_types: list[str]
        ) -> str | None:
            """Match booking item_type to a trip's ticket type (with backward compatibility).

            Returns the matching trip ticket_type, or None if no match.
            """
            # Direct match
            if item_type in trip_ticket_types:
                return item_type
            # Try with _ticket suffix removed (legacy: item_type="adult" matches trip_ticket_type="adult_ticket")
            if item_type.endswith("_ticket"):
                base = item_type[:-7]
                if base in trip_ticket_types:
                    return base
            # Try adding _ticket suffix (legacy: item_type="adult" matches trip_ticket_type="adult_ticket")
            with_suffix = f"{item_type}_ticket"
            if with_suffix in trip_ticket_types:
                return with_suffix
            return None

        # Define all available fields
        base_fields = {
            "confirmation_code": "Confirmation Code",
            "customer_name": "Customer Name",
            "email": "Email",
            "phone": "Phone",
            "billing_address": "Billing Address",
            "status": "Status",
            "total_amount": "Total Amount",
            "subtotal": "Subtotal",
            "discount_amount": "Discount Amount",
            "tax_amount": "Tax Amount",
            "tip_amount": "Tip Amount",
            "created_at": "Created At",
            "trip_type": "Trip Type",
            "boat_name": "Boat Name",
        }

        # Parse fields parameter
        selected_fields: list[str] = []
        if fields:
            selected_fields = [f.strip() for f in fields.split(",") if f.strip()]
        else:
            # If no fields specified, include all fields
            selected_fields = list(base_fields.keys()) + ["ticket_types", "swag"]

        # Validate selected fields; support granular ticket_types and swag
        valid_fields = set(base_fields.keys()) | {
            "ticket_types",
            "ticket_types_quantity",
            "ticket_types_price",
            "ticket_types_total",
            "swag",
            "swag_description",
            "swag_total",
        }
        selected_fields = [f for f in selected_fields if f in valid_fields]

        # If no valid fields selected, use all fields
        if not selected_fields:
            selected_fields = list(base_fields.keys()) + ["ticket_types", "swag"]

        # Which ticket/swag sub-columns to include
        include_ticket_quantity = (
            "ticket_types" in selected_fields
            or "ticket_types_quantity" in selected_fields
        )
        include_ticket_price = (
            "ticket_types" in selected_fields or "ticket_types_price" in selected_fields
        )
        include_ticket_total = (
            "ticket_types" in selected_fields or "ticket_types_total" in selected_fields
        )
        include_swag_description = (
            "swag" in selected_fields or "swag_description" in selected_fields
        )
        include_swag_total = (
            "swag" in selected_fields or "swag_total" in selected_fields
        )

        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)

        # Build header: base fields in order, then ticket columns, then swag
        header = []
        for field_key in selected_fields:
            if field_key in base_fields:
                header.append(base_fields[field_key])
        if include_ticket_quantity or include_ticket_price or include_ticket_total:
            for ticket_type in sorted_ticket_types:
                if include_ticket_quantity:
                    header.append(f"{ticket_type} Quantity")
                if include_ticket_price:
                    header.append(f"{ticket_type} Price")
                if include_ticket_total:
                    header.append(f"{ticket_type} Total")
        if include_swag_description:
            header.append("Swag Description")
        if include_swag_total:
            header.append("Swag Total")

        writer.writerow(header)

        # Write booking data - one row per booking
        for booking in bookings:
            # Get booking items (filter by trip_id if provided)
            item_query = select(BookingItem).where(BookingItem.booking_id == booking.id)
            if trip_id:
                item_query = item_query.where(BookingItem.trip_id == trip_id)
            items = session.exec(item_query).all()

            # Aggregate items by type
            tickets: dict[
                str, dict[str, int]
            ] = {}  # ticket_type -> {qty, price (cents)}
            swag_items: list[str] = []
            swag_total = 0.0

            trip_type = ""
            boat_name = ""

            for item in items:
                # Get trip and boat info from first item
                if not trip_type:
                    trip = session.get(Trip, item.trip_id)
                    if trip:
                        trip_type = trip.type
                if not boat_name:
                    boat = session.get(Boat, item.boat_id)
                    if boat:
                        boat_name = boat.name

                # Group items by type
                # Merchandise items have trip_merchandise_id set
                if item.trip_merchandise_id:
                    # Merchandise item - item_type contains the merchandise name
                    merch_name = item.item_type
                    swag_items.append(
                        f"{merch_name} x{item.quantity}"
                        if item.quantity > 1
                        else merch_name
                    )
                    swag_total += item.price_per_unit * item.quantity
                else:
                    # Ticket item - match to trip's ticket types if trip_id provided
                    if trip_id and will_include_ticket_types:
                        # Match item_type to trip's ticket type (with backward compatibility)
                        matched_type = match_item_to_ticket_type(
                            item.item_type, sorted_ticket_types
                        )
                        if matched_type:
                            if matched_type not in tickets:
                                tickets[matched_type] = {
                                    "qty": 0,
                                    "price": 0,
                                }  # price in cents
                            tickets[matched_type]["qty"] += item.quantity
                            tickets[matched_type]["price"] += (
                                item.price_per_unit * item.quantity
                            )
                    else:
                        # Fallback: normalize for exports without trip selection
                        def normalize_ticket_type(raw: str) -> str:
                            if raw.endswith("_ticket"):
                                return raw[:-7]
                            return raw

                        normalized_type = normalize_ticket_type(item.item_type)
                        if normalized_type not in tickets:
                            tickets[normalized_type] = {
                                "qty": 0,
                                "price": 0,
                            }  # price in cents
                        tickets[normalized_type]["qty"] += item.quantity
                        tickets[normalized_type]["price"] += (
                            item.price_per_unit * item.quantity
                        )

            # Build row data based on selected fields (amounts in dollars for CSV display)
            row = []
            field_data = {
                "confirmation_code": booking.confirmation_code,
                "customer_name": booking.user_name,
                "email": booking.user_email,
                "phone": booking.user_phone,
                "billing_address": booking.billing_address,
                "status": booking.status,
                "total_amount": round(booking.total_amount / 100, 2),
                "subtotal": round(booking.subtotal / 100, 2),
                "discount_amount": round(booking.discount_amount / 100, 2),
                "tax_amount": round(booking.tax_amount / 100, 2),
                "tip_amount": round(booking.tip_amount / 100, 2),
                "created_at": booking.created_at.isoformat(),
                "trip_type": trip_type,
                "boat_name": boat_name,
            }

            # Base fields in selected order
            for field_key in selected_fields:
                if field_key in field_data:
                    row.append(field_data[field_key])
            # Ticket columns (same order as header)
            if include_ticket_quantity or include_ticket_price or include_ticket_total:
                for ticket_type in sorted_ticket_types:
                    if ticket_type in tickets:
                        data = tickets[ticket_type]
                        if include_ticket_quantity:
                            row.append(data["qty"])
                        if include_ticket_price:
                            row.append(
                                f"{data['price'] / data['qty'] / 100:.2f}"
                                if data["qty"] > 0
                                else "0.00"
                            )
                        if include_ticket_total:
                            row.append(f"{data['price'] / 100:.2f}")
                    else:
                        if include_ticket_quantity:
                            row.append("")
                        if include_ticket_price:
                            row.append("")
                        if include_ticket_total:
                            row.append("")
            # Swag columns
            if include_swag_description:
                row.append(", ".join(swag_items) if swag_items else "")
            if include_swag_total:
                row.append(f"{swag_total / 100:.2f}" if swag_total else "")

            writer.writerow(row)

        # Get CSV content
        csv_content = output.getvalue()
        output.close()

        # Create response
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bookings_export.csv"},
        )

    except Exception as e:
        logger.exception(f"Error exporting bookings CSV: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while exporting data. Please try again later.",
        )
