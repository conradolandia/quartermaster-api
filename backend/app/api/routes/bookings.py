import base64
import io
import logging
import random
import string
import uuid

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.api import deps
from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingItemPublic,
    BookingPublic,
    BookingUpdate,
    Mission,
    Trip,
    TripBoat,
)
from app.utils import (
    generate_booking_cancelled_email,
    generate_booking_confirmation_email,
    generate_booking_refunded_email,
    send_email,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get(
    "/qr/{confirmation_code}",
    response_class=RedirectResponse,
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
)
def qr_code_redirect(confirmation_code: str):
    """
    Redirects QR code scans to the actual check-in endpoint.

    This provides a stable URL for QR codes that won't break if the admin dashboard URL changes.
    """
    target_url = f"{settings.QR_CODE_BASE_URL}/check-in?booking={confirmation_code}"
    logger.info(f"Redirecting QR scan for {confirmation_code} to {target_url}")
    return target_url


def generate_qr_code(confirmation_code: str) -> str:
    """Generate a QR code for a booking confirmation code and return as base64 string."""
    # Use stable internal URL that won't change even if admin URL changes
    qr_url = f"{settings.FRONTEND_HOST}/api/v1/bookings/qr/{confirmation_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# --- Public Endpoints ---


@router.post("/", response_model=BookingPublic, status_code=status.HTTP_201_CREATED)
def create_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_in: BookingCreate,
) -> BookingPublic:
    """
    Create a new booking (public endpoint).
    """
    try:
        # 1. Validate mission exists and is active
        mission = session.get(Mission, booking_in.mission_id)
        if not mission:
            logger.warning(
                f"Booking attempt for non-existent mission ID: {booking_in.mission_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission with ID {booking_in.mission_id} does not exist",
            )

        if not mission.active:
            logger.info(f"Booking attempt for inactive mission: {mission.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mission {mission.name} is not currently accepting bookings",
            )

        # 2. Validate tip is non-negative
        if booking_in.tip_amount < 0:
            logger.warning(f"Negative tip amount attempted: {booking_in.tip_amount}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tip amount cannot be negative",
            )

        # 3. Validate all referenced trips and boats exist and are active
        if not booking_in.items:
            logger.warning("Booking creation attempted with no items")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one booking item is required",
            )

        for item in booking_in.items:
            trip = session.get(Trip, item.trip_id)
            if not trip:
                logger.warning(
                    f"Booking references non-existent trip ID: {item.trip_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Trip with ID {item.trip_id} does not exist",
                )

            if not trip.active:
                logger.info(f"Booking attempt for inactive trip: {trip.id}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Trip with ID {item.trip_id} is not currently accepting bookings",
                )

            boat = session.get(Boat, item.boat_id)
            if not boat:
                logger.warning(
                    f"Booking references non-existent boat ID: {item.boat_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Boat with ID {item.boat_id} does not exist",
                )

            # Verify trip and mission match
            if trip.mission_id != mission.id:
                logger.warning(
                    f"Trip {trip.id} does not belong to mission {mission.id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Trip {trip.id} does not belong to the selected mission",
                )

        # 4. Capacity check (simplified: sum all tickets for each trip/boat, compare to capacity)
        # For MVP, assume no concurrent bookings and no overrides
        for item in booking_in.items:
            # Get max capacity (from trip_boat if exists, else boat)
            trip_boat = session.exec(
                select(TripBoat).where(
                    TripBoat.trip_id == item.trip_id, TripBoat.boat_id == item.boat_id
                )
            ).first()

            if not trip_boat:
                logger.warning(
                    f"Trip {item.trip_id} is not associated with boat {item.boat_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Trip {item.trip_id} is not associated with boat {item.boat_id}",
                )

            boat = session.get(Boat, item.boat_id)
            max_capacity = (
                trip_boat.max_capacity
                if trip_boat and trip_boat.max_capacity
                else boat.capacity
            )

            # Count already booked tickets for this trip/boat
            booked = session.exec(
                select(BookingItem).where(
                    BookingItem.trip_id == item.trip_id,
                    BookingItem.boat_id == item.boat_id,
                    BookingItem.status == "active",
                )
            ).all()
            already_booked = sum(b.quantity for b in booked)

            if already_booked + item.quantity > max_capacity:
                available = max_capacity - already_booked
                logger.info(
                    f"Capacity exceeded for trip {item.trip_id}, boat {item.boat_id}: "
                    f"requested {item.quantity}, available {available}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Not enough capacity for trip {item.trip_id} and boat {item.boat_id}. "
                        f"Requested: {item.quantity}, Available: {available}"
                    ),
                )

        # 5. Generate a unique confirmation code
        def generate_confirmation_code(length=8):
            return "".join(
                random.choices(string.ascii_uppercase + string.digits, k=length)
            )

        confirmation_code = generate_confirmation_code()
        while session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first():
            confirmation_code = generate_confirmation_code()

        # 6. Create Booking instance
        # We need to exclude items to avoid the SQLAlchemy relationship error
        booking_data = booking_in.model_dump(exclude={"items"})
        booking_data["confirmation_code"] = confirmation_code
        booking = Booking(**booking_data)

        booking_items = []
        try:
            session.add(booking)
            session.commit()
            session.refresh(booking)

            # 7. Create BookingItems
            for item_in in booking_in.items:
                item_data = item_in.model_dump()
                item_data["booking_id"] = booking.id
                booking_item = BookingItem(**item_data)
                session.add(booking_item)
                booking_items.append(booking_item)

            # Generate and store QR code
            qr_code = generate_qr_code(booking.confirmation_code)
            booking.qr_code_base64 = qr_code
            session.add(booking)

            session.commit()
            logger.info(f"Booking created successfully: {booking.confirmation_code}")
        except Exception as e:
            session.rollback()
            logger.error(f"Database error during booking creation: {str(e)}")

            # Extract more user-friendly error message if possible
            error_message = str(e).lower()
            if "foreign key constraint" in error_message:
                if "booking_mission_id_fkey" in error_message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Mission with ID {booking_in.mission_id} does not exist",
                    )
                elif "booking_item_trip_id_fkey" in error_message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="One or more referenced trips do not exist",
                    )
                elif "booking_item_boat_id_fkey" in error_message:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="One or more referenced boats do not exist",
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid reference to a non-existent entity",
                    )
            elif "unique constraint" in error_message:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A booking with this confirmation code already exists",
                )
            elif "not null constraint" in error_message:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing required field in booking data",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="An unexpected error occurred while creating the booking",
                )

        # 8. Send booking confirmation email
        try:
            if settings.emails_enabled:
                # Prepare items for email template
                email_items = []
                for item in booking_items:
                    trip = session.get(Trip, item.trip_id)
                    boat = session.get(Boat, item.boat_id)
                    trip_type = (
                        "Launch Viewing"
                        if trip.type == "launch_viewing"
                        else "Pre-Launch Viewing"
                    )
                    item_type = f"{trip_type} - {boat.name}"

                    email_items.append(
                        {
                            "quantity": item.quantity,
                            "type": item_type,
                            "price_per_unit": item.price_per_unit,
                        }
                    )

                # Generate and send email
                email_data = generate_booking_confirmation_email(
                    email_to=booking.user_email,
                    user_name=booking.user_name,
                    confirmation_code=booking.confirmation_code,
                    mission_name=mission.name,
                    booking_items=email_items,
                    total_amount=booking.total_amount,
                )

                send_email(
                    email_to=booking.user_email,
                    subject=email_data.subject,
                    html_content=email_data.html_content,
                )

                logger.info(f"Booking confirmation email sent to {booking.user_email}")
            else:
                logger.warning(
                    "Email sending is disabled. Confirmation email not sent."
                )
        except Exception as e:
            # Don't fail the booking if email sending fails
            logger.error(f"Failed to send booking confirmation email: {str(e)}")

        # Query items for response
        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in items
        ]

        return booking_public

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error in create_booking: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


@router.get("/{confirmation_code}", response_model=BookingPublic)
def get_booking_by_confirmation_code(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> BookingPublic:
    """
    Retrieve a booking by confirmation code (public endpoint).
    """
    try:
        # Validate confirmation code
        if not confirmation_code or len(confirmation_code) < 3:
            logger.warning(
                f"Invalid booking confirmation code format: {confirmation_code}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid booking confirmation code format",
            )

        # Fetch booking
        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()

        if not booking:
            logger.info(f"Booking not found for confirmation code: {confirmation_code}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found with the provided confirmation code",
            )

        # Fetch items
        items = []
        try:
            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()

            if not items:
                logger.warning(f"Booking found but has no items: {booking.id}")
        except Exception as e:
            logger.error(f"Error retrieving items for booking {booking.id}: {str(e)}")
            # Continue without items rather than failing completely

        # Prepare response
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in items
        ]

        # Handle QR code generation
        if not booking.qr_code_base64:
            logger.info(f"Generating missing QR code for booking: {booking.id}")
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

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(
            f"Unexpected error retrieving booking {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


# --- Admin-Restricted Endpoints (use dependency for access control) ---


@router.get(
    "/",
    response_model=list[BookingPublic],
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def list_bookings(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> list[BookingPublic]:
    """
    List/search bookings (admin only).
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

        # Fetch bookings
        bookings = []
        try:
            bookings = session.exec(select(Booking).offset(skip).limit(limit)).all()
            logger.info(
                f"Retrieved {len(bookings)} bookings (skip={skip}, limit={limit})"
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

        return result

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
