import base64
import io
import logging
import random
import string
import uuid

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlmodel import Session, select

from app.api import deps
from app.core.config import settings
from app.core.stripe import create_payment_intent
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingItemPublic,
    BookingPublic,
    BookingStatus,
    BookingUpdate,
    Mission,
    Trip,
)
from app.utils import (
    generate_booking_cancelled_email,
    generate_booking_refunded_email,
    send_email,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def generate_qr_code(confirmation_code: str) -> str:
    """Generate a QR code for a booking confirmation code and return as base64 string."""
    # Use direct frontend URL for better performance (no redirect needed)
    qr_url = f"{settings.FRONTEND_HOST}/bookings?code={confirmation_code}"
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

    # Validate all boats exist
    for item in booking_in.items:
        boat = session.get(Boat, item.boat_id)
        if not boat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Boat {item.boat_id} not found",
            )

    # Don't create PaymentIntent yet - booking starts as draft

    # Generate confirmation code
    def generate_confirmation_code(length=8):
        """Generate a random confirmation code."""

        # Use uppercase letters and numbers, excluding similar-looking characters
        chars = string.ascii_uppercase.replace("I", "").replace(
            "O", ""
        ) + string.digits.replace("0", "").replace("1", "")
        return "".join(random.choice(chars) for _ in range(length))

    # Keep generating until we get a unique code
    while True:
        confirmation_code = generate_confirmation_code()
        existing = (
            session.query(Booking)
            .filter(Booking.confirmation_code == confirmation_code)
            .first()
        )
        if not existing:
            break

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

    # Commit to get IDs
    session.commit()
    session.refresh(booking)

    # Generate QR code
    booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)

    # Update booking with QR code
    session.add(booking)
    session.commit()
    session.refresh(booking)

    return booking


@router.post("/{confirmation_code}/initialize-payment")
def initialize_payment(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> dict:
    """
    Initialize payment for a draft booking.
    Creates a PaymentIntent and updates booking status to pending_payment.
    """
    try:
        # Get booking
        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found",
            )

        # Check if booking is in draft status
        if booking.status != BookingStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot initialize payment for booking with status '{booking.status}'",
            )

        # Check if PaymentIntent already exists
        if booking.payment_intent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment already initialized for this booking",
            )

        # Calculate total amount in cents for Stripe
        total_amount_cents = int(booking.total_amount * 100)

        # Create PaymentIntent
        payment_intent = create_payment_intent(total_amount_cents)

        # Update booking with PaymentIntent ID and status
        booking.payment_intent_id = payment_intent.id
        booking.status = BookingStatus.pending_payment

        session.add(booking)
        session.commit()
        session.refresh(booking)

        return {
            "payment_intent_id": payment_intent.id,
            "client_secret": payment_intent.client_secret,
            "status": "pending_payment",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"Error initializing payment for booking {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize payment",
        )


@router.get("/qr/{confirmation_code}")
def get_booking_qr_code(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> Response:
    """
    Get QR code image for a booking confirmation code.
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

        # Generate QR code image
        qr_url = f"{settings.FRONTEND_HOST}/bookings?code={confirmation_code}"
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to bytes
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        return Response(
            content=buf.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=booking_{confirmation_code}_qr.png"
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(
            f"Unexpected error generating QR code for booking {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred generating QR code.",
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
