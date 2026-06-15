"""Booking refund endpoint."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api import deps
from app.models import (
    Booking,
    BookingItemPublic,
    BookingPublic,
)
from app.services.refund import RefundProcessingError, process_booking_refund

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
    refund_item_ids: list[uuid.UUID] | None = None


@router.post(
    "/refund/{confirmation_code}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_admin)],
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
    refund_item_ids: When set, refunds those line items (price + proportional tax).
    Validates the booking and processes the refund through Stripe,
    then updates the booking status to 'refunded'.
    """
    refund_reason = body.refund_reason
    refund_notes = body.refund_notes
    refund_amount_cents = body.refund_amount_cents
    refund_item_ids = body.refund_item_ids
    try:
        validate_confirmation_code(confirmation_code)

        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()

        if not booking:
            logger.warning(
                "Booking not found for confirmation code: %s", confirmation_code
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found with the provided confirmation code",
            )

        try:
            booking = process_booking_refund(
                session,
                booking,
                refund_reason=refund_reason,
                refund_notes=refund_notes,
                refund_amount_cents=refund_amount_cents,
                refund_item_ids=refund_item_ids,
            )
        except RefundProcessingError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=e.detail,
            ) from e

        updated_items = get_booking_items_in_display_order(session, booking.id)
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in updated_items
        ]

        logger.info("Successfully processed refund for booking %s", confirmation_code)
        return booking_public

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.exception(
            "Unexpected error during refund processing for %s: %s",
            confirmation_code,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during refund processing. Please try again later.",
        ) from e
