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
from app.core.stripe import update_payment_intent_amount
from app.models import (
    Booking,
    BookingDraftUpdate,
    BookingExperienceDisplay,
    BookingItemPublic,
    BookingPublic,
    BookingStatus,
)
from app.utils import generate_booking_confirmation_email, send_email

from .booking_utils import (
    build_experience_display_dict,
    generate_qr_code,
    get_booking_items_in_display_order,
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


@router.patch(
    "/{confirmation_code}",
    response_model=BookingPublic,
    operation_id="booking_public_update_draft_booking",
)
def update_draft_booking_by_confirmation_code(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
    booking_in: BookingDraftUpdate,
) -> BookingPublic:
    """
    Update a draft or pending_payment booking by confirmation code (public).
    Only customer details and optional pricing fields can be updated.
    """
    try:
        validate_confirmation_code(confirmation_code)
        update_data = booking_in.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided",
            )

        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found with the provided confirmation code",
            )
        if booking.status not in (
            BookingStatus.draft,
            BookingStatus.pending_payment,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update booking with status '{booking.status}'",
            )

        if "tip_amount" in update_data and update_data["tip_amount"] is not None:
            if update_data["tip_amount"] < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tip amount cannot be negative",
                )
        for amount_field in (
            "subtotal",
            "discount_amount",
            "tax_amount",
            "total_amount",
        ):
            if amount_field in update_data and update_data[amount_field] is not None:
                if update_data[amount_field] < 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"{amount_field} cannot be negative",
                    )

        for key, value in update_data.items():
            setattr(booking, key, value)
        session.add(booking)
        session.commit()
        session.refresh(booking)

        # Sync amount to Stripe when total changed and payment already initialized
        if (
            "total_amount" in update_data
            and booking.payment_intent_id
            and booking.status == BookingStatus.pending_payment
            and booking.total_amount >= 50
        ):
            updated_pi = update_payment_intent_amount(
                booking.payment_intent_id, booking.total_amount
            )
            if not updated_pi:
                logger.warning(
                    "Could not update PaymentIntent %s amount to %s (e.g. not mutable)",
                    booking.payment_intent_id,
                    booking.total_amount,
                )

        items = get_booking_items_in_display_order(session, booking.id)
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in items
        ]
        return booking_public

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"Unexpected error updating draft booking {confirmation_code}: {e}"
        )
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
        # Get booking with items and QR code generation
        booking = get_booking_with_items(session, confirmation_code)

        items = []
        try:
            items = get_booking_items_in_display_order(session, booking.id)

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

        # Populate experience_display from first item (trip/mission/launch/boat) so public detail works without read_public_trip (which 404s for past trips)
        if items:
            exp_dict = build_experience_display_dict(session, items)
            if exp_dict:
                model_fields = set(BookingExperienceDisplay.model_fields)
                booking_public.experience_display = BookingExperienceDisplay(
                    **{k: v for k, v in exp_dict.items() if k in model_fields}
                )

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

        # Get mission name, booking items, and experience display for email
        mission_name = get_mission_name_for_booking(session, booking)
        booking_items = prepare_booking_items_for_email(booking)
        items = get_booking_items_in_display_order(session, booking.id)
        experience_display = (
            build_experience_display_dict(session, items) if items else None
        )
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
            experience_display=experience_display,
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
