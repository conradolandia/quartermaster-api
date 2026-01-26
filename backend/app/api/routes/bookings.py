import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.api import deps
from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingItemPublic,
    BookingItemStatus,
    BookingPublic,
    BookingStatus,
    BookingUpdate,
    DiscountCode,
    Mission,
    Trip,
    TripBoat,
    TripMerchandise,
    TripPricing,
)
from app.utils import (
    generate_booking_cancelled_email,
    generate_booking_refunded_email,
    send_email,
)

from .booking_utils import generate_qr_code, validate_confirmation_code

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


# --- Public Endpoints ---


@router.post("/", response_model=BookingPublic, status_code=status.HTTP_201_CREATED)
def create_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_in: BookingCreate,
) -> BookingPublic:
    """
    Create new booking.
    """
    # Validate that booking has items
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

    # Enforce booking_mode access control
    if mission.booking_mode == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for this mission",
        )
    elif mission.booking_mode == "early_bird":
        # Require a valid access code (passed via discount_code_id)
        if not booking_in.discount_code_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An access code is required to book this mission",
            )
        # Validate that the discount code is a valid access code
        discount_code = session.get(DiscountCode, booking_in.discount_code_id)
        if not discount_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid access code",
            )
        if not discount_code.is_access_code:
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
        if item.item_type in ("adult_ticket", "child_ticket", "infant_ticket"):
            # Ticket pricing must match TripPricing
            pricing = session.exec(
                select(TripPricing).where(
                    (TripPricing.trip_id == item.trip_id)
                    & (TripPricing.ticket_type == item.item_type.replace("_ticket", ""))
                )
            ).first()
            if not pricing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No pricing configured for {item.item_type}",
                )
            if abs(pricing.price - item.price_per_unit) > 0.0001:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ticket price mismatch",
                )
        elif item.item_type == "swag":
            # Merchandise must reference a valid TripMerchandise row and have inventory
            if item.trip_merchandise_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Merchandise item is missing reference",
                )
            merch = session.get(TripMerchandise, item.trip_merchandise_id)
            if not merch or merch.trip_id != item.trip_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid merchandise reference",
                )
            if merch.quantity_available < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient merchandise inventory",
                )
            if abs(merch.price - item.price_per_unit) > 0.0001:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Merchandise price mismatch",
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

    # Create booking as draft (no PaymentIntent yet)
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
        status=BookingStatus.draft,  # Start as draft
        launch_updates_pref=booking_in.launch_updates_pref,
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

    # Decrement inventory for merchandise items
    try:
        for item in booking_items:
            if item.trip_merchandise_id:
                merch = session.get(TripMerchandise, item.trip_merchandise_id)
                if merch:
                    merch.quantity_available = max(
                        0, merch.quantity_available - item.quantity
                    )
                    session.add(merch)
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

    return booking


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
    sort_by: str = "created_at",
    sort_direction: str = "desc",
) -> BookingsPaginatedResponse:
    """
    List/search bookings (admin only).
    Optionally filter by mission_id.
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

        # Apply mission filter if provided
        if mission_id:
            # Filter bookings by mission through BookingItem -> Trip -> Mission
            base_query = (
                base_query.join(BookingItem, BookingItem.booking_id == Booking.id)
                .join(Trip, Trip.id == BookingItem.trip_id)
                .where(Trip.mission_id == mission_id)
                .distinct()
            )
            logger.info(f"Filtering bookings by mission_id: {mission_id}")

        # Get total count first
        total_count = 0
        try:
            count_query = select(func.count(Booking.id.distinct()))
            if mission_id:
                count_query = (
                    count_query.select_from(Booking)
                    .join(BookingItem, BookingItem.booking_id == Booking.id)
                    .join(Trip, Trip.id == BookingItem.trip_id)
                    .where(Trip.mission_id == mission_id)
                )
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

        # 1. Enforce business rules
        # Disallow updates to items/quantities via PATCH (MVP)
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
                "pending_payment": ["confirmed", "cancelled"],
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
                            refund_amount=booking.total_amount,
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
    refund_amount: float | None = None,
) -> BookingPublic:
    """
    Process a refund for a booking.

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

        # Validate refund amount
        if refund_amount is not None and refund_amount > booking.total_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount cannot exceed the total booking amount",
            )

        # Process Stripe refund if payment intent exists
        if booking.payment_intent_id:
            try:
                from app.core.stripe import refund_payment

                # Convert refund amount to cents for Stripe
                stripe_amount = int((refund_amount or booking.total_amount) * 100)
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
                refund_amount=refund_amount or booking.total_amount,
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
) -> Response:
    """
    Export bookings data to CSV format.

    Supports filtering by mission_id, trip_id, and booking_status.
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

        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header - one row per booking with flattened item columns
        writer.writerow(
            [
                "Confirmation Code",
                "Customer Name",
                "Email",
                "Phone",
                "Billing Address",
                "Status",
                "Total Amount",
                "Subtotal",
                "Discount Amount",
                "Tax Amount",
                "Tip Amount",
                "Created At",
                "Trip Type",
                "Boat Name",
                "Adult Tickets",
                "Adult Price",
                "Child Tickets",
                "Child Price",
                "Infant Tickets",
                "Infant Price",
                "Swag Description",
                "Swag Total",
            ]
        )

        # Write booking data - one row per booking
        for booking in bookings:
            # Get booking items
            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()

            # Aggregate items by type
            adults_qty = 0
            adults_price = 0.0
            children_qty = 0
            children_price = 0.0
            infants_qty = 0
            infants_price = 0.0
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

                if item.item_type == "adult_ticket":
                    adults_qty += item.quantity
                    adults_price += item.price_per_unit * item.quantity
                elif item.item_type == "child_ticket":
                    children_qty += item.quantity
                    children_price += item.price_per_unit * item.quantity
                elif item.item_type == "infant_ticket":
                    infants_qty += item.quantity
                    infants_price += item.price_per_unit * item.quantity
                elif item.item_type == "swag":
                    # Get merchandise name if available
                    merch_name = "Merchandise"
                    if item.trip_merchandise_id:
                        merch = session.get(TripMerchandise, item.trip_merchandise_id)
                        if merch:
                            merch_name = merch.name
                    swag_items.append(
                        f"{merch_name} x{item.quantity}"
                        if item.quantity > 1
                        else merch_name
                    )
                    swag_total += item.price_per_unit * item.quantity

            writer.writerow(
                [
                    booking.confirmation_code,
                    booking.user_name,
                    booking.user_email,
                    booking.user_phone,
                    booking.billing_address,
                    booking.status,
                    booking.total_amount,
                    booking.subtotal,
                    booking.discount_amount,
                    booking.tax_amount,
                    booking.tip_amount,
                    booking.created_at.isoformat(),
                    trip_type,
                    boat_name,
                    adults_qty or "",
                    f"{adults_price:.2f}" if adults_price else "",
                    children_qty or "",
                    f"{children_price:.2f}" if children_price else "",
                    infants_qty or "",
                    f"{infants_price:.2f}" if infants_price else "",
                    ", ".join(swag_items) if swag_items else "",
                    f"{swag_total:.2f}" if swag_total else "",
                ]
            )

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
