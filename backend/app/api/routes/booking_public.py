"""
Public booking endpoints.

This module contains booking endpoints that are accessible without authentication,
such as retrieving bookings by confirmation code, QR codes, and email resend.
"""

import io
import logging

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlmodel import Session, select

from app.api import deps
from app.core.config import settings
from app.models import (
    Booking,
    BookingItem,
    BookingItemPublic,
    BookingPublic,
    BookingStatus,
)
from app.utils import generate_booking_confirmation_email, send_email

from .booking_utils import (
    get_booking_with_items,
    get_mission_name_for_booking,
    prepare_booking_items_for_email,
    validate_confirmation_code,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


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
        validate_confirmation_code(confirmation_code)

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

        # Generate QR code image (points to admin check-in URL)
        base_url = settings.QR_CODE_BASE_URL or settings.FRONTEND_HOST
        qr_url = f"{base_url}/check-in?code={confirmation_code}"
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
        # Get booking with items and QR code generation
        booking = get_booking_with_items(session, confirmation_code)

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


@router.post(
    "/{confirmation_code}/resend-email",
    operation_id="booking_public_resend_booking_confirmation_email",
)
def resend_booking_confirmation_email(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> dict:
    """
    Resend booking confirmation email.

    Args:
        confirmation_code: The booking confirmation code

    Returns:
        dict: Status of the email sending
    """
    try:
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

        # Generate and send the email
        email_data = generate_booking_confirmation_email(
            email_to=booking.user_email,
            user_name=booking.user_name,
            confirmation_code=booking.confirmation_code,
            mission_name=mission_name,
            booking_items=booking_items,
            total_amount=booking.total_amount,
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
