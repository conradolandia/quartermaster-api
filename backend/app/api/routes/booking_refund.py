"""Booking refund endpoint."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api import deps
from app.models import (
    Booking,
    BookingItem,
    BookingItemPublic,
    BookingItemStatus,
    BookingPublic,
    BookingStatus,
    MerchandiseVariation,
    Mission,
    PaymentStatus,
)
from app.utils import send_email

from .booking_utils import (
    get_booking_items_in_display_order,
    validate_confirmation_code,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


class RefundRequest(BaseModel):
    refund_reason: str
    refund_notes: str | None = None
    refund_amount_cents: int | None = None


@router.post(
    "/refund/{confirmation_code}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def process_refund(
    confirmation_code: str,
    body: RefundRequest,
    *,
    session: Session = Depends(deps.get_db),
) -> BookingPublic:
    """
    Process a refund for a booking.

    refund_amount_cents: Amount to refund in cents. If None, refunds full booking total.
    Validates the booking and processes the refund through Stripe,
    then updates the booking status to 'refunded'.
    """
    refund_reason = body.refund_reason
    refund_notes = body.refund_notes
    refund_amount_cents = body.refund_amount_cents
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

        # Validate booking status (cancelled/refunded = terminal; allow confirmed/checked_in/completed)
        if booking.booking_status not in [
            BookingStatus.confirmed,
            BookingStatus.checked_in,
            BookingStatus.completed,
        ]:
            logger.warning(
                f"Invalid booking status for refund: {booking.booking_status} (confirmation: {confirmation_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot refund booking with status '{booking.booking_status}'. Booking must be 'confirmed', 'checked_in', or 'completed'.",
            )

        refunded_so_far = getattr(booking, "refunded_amount_cents", 0) or 0
        remaining_refundable = booking.total_amount - refunded_so_far
        if remaining_refundable <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No remaining amount to refund for this booking.",
            )

        # Validate refund amount (all in cents)
        amount_to_refund = (
            refund_amount_cents
            if refund_amount_cents is not None
            else remaining_refundable
        )
        if amount_to_refund > remaining_refundable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount cannot exceed remaining refundable amount (${remaining_refundable / 100:.2f}).",
            )
        if amount_to_refund <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount must be positive.",
            )

        logger.info(
            f"process_refund received reason={refund_reason!r} notes={refund_notes!r} "
            f"for booking {confirmation_code}"
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

        # Update cumulative refund and store reason/notes at booking level (for display)
        booking.refunded_amount_cents = refunded_so_far + amount_to_refund
        booking.refund_reason = refund_reason
        booking.refund_notes = refund_notes
        session.add(booking)

        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

        # Always store refund reason and notes on all items (for display in booking details)
        for item in items:
            item.refund_reason = refund_reason
            item.refund_notes = refund_notes
            session.add(item)

        if booking.refunded_amount_cents >= booking.total_amount:
            booking.booking_status = BookingStatus.cancelled
            booking.payment_status = PaymentStatus.refunded
            for item in items:
                was_fulfilled = item.status == BookingItemStatus.fulfilled
                item.status = BookingItemStatus.refunded
                session.add(item)
                # Return inventory to variation: decrement quantity_sold and, if was fulfilled, quantity_fulfilled
                if item.merchandise_variation_id:
                    variation = session.get(
                        MerchandiseVariation, item.merchandise_variation_id
                    )
                    if variation:
                        variation.quantity_sold -= item.quantity
                        variation.quantity_sold = max(0, variation.quantity_sold)
                        if was_fulfilled:
                            variation.quantity_fulfilled -= item.quantity
                            variation.quantity_fulfilled = max(
                                0, variation.quantity_fulfilled
                            )
                        session.add(variation)
        else:
            # Partial refund: keep booking_status (confirmed/checked_in/completed); only payment is partially_refunded
            booking.payment_status = PaymentStatus.partially_refunded

        # Commit all changes
        session.commit()
        session.refresh(booking)

        # Log first item so we can confirm reason/notes were persisted (debug)
        first_item = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).first()
        if first_item:
            logger.info(
                f"process_refund after commit item refund_reason={first_item.refund_reason!r} "
                f"refund_notes={first_item.refund_notes!r}"
            )

        # Send refund confirmation email
        try:
            from app.utils import generate_booking_refunded_email

            # Get mission name
            mission = session.get(Mission, booking.mission_id)
            mission_name = mission.name if mission else "Unknown Mission"

            email_data = generate_booking_refunded_email(
                email_to=booking.user_email,
                user_name=f"{booking.first_name} {booking.last_name}".strip(),
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

        updated_items = get_booking_items_in_display_order(session, booking.id)
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
