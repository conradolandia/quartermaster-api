"""
Payment-related booking endpoints.

This module contains booking endpoints that handle payment operations
(resume payment, confirm free booking).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.api import deps
from app.api.routes.booking_utils import get_booking_with_items
from app.core.stripe import retrieve_payment_intent
from app.crud.capacity_holds import (
    hold_expiry_utc,
    lock_trip_boats_for_ticket_items,
    trip_boat_pairs_from_booking,
    validate_capacity_for_booking_lines,
)
from app.models import Booking, BookingStatus, PaymentStatus

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/{confirmation_code}/resume-payment")
def resume_payment(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> dict:
    """
    Return existing PaymentIntent client_secret for a draft checkout (pending_payment
    or failed payment attempt). Allows resuming without creating a new PaymentIntent.
    """
    try:
        booking = session.exec(
            select(Booking)
            .where(Booking.confirmation_code == confirmation_code)
            .options(selectinload(Booking.items))
            .with_for_update()
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found",
            )

        if booking.booking_status != BookingStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot resume payment for booking with booking_status '{booking.booking_status}'",
            )
        if booking.payment_status not in (
            PaymentStatus.pending_payment,
            PaymentStatus.failed,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot resume payment for booking with payment_status '{booking.payment_status}'",
            )

        if not booking.payment_intent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No payment intent for this booking",
            )

        pairs = trip_boat_pairs_from_booking(booking)
        lock_trip_boats_for_ticket_items(session=session, trip_boat_pairs=pairs)
        validate_capacity_for_booking_lines(
            session=session,
            booking=booking,
            exclude_booking_id=booking.id,
        )
        booking.capacity_hold_expires_at = hold_expiry_utc()
        session.add(booking)
        session.commit()
        session.refresh(booking)

        payment_intent = retrieve_payment_intent(booking.payment_intent_id)
        return {
            "payment_intent_id": payment_intent.id,
            "client_secret": payment_intent.client_secret,
            "status": "pending_payment",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"Error resuming payment for booking {confirmation_code}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume payment",
        )


@router.post("/{confirmation_code}/confirm-free-booking")
def confirm_free_booking(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> dict:
    """
    Confirm a free or sub-minimum (total_amount < 50 cents) draft booking without payment.
    Sets booking to confirmed, sends confirmation email, returns success.
    """
    from app.api.routes.payments import send_booking_confirmation_email
    from app.crud.capacity_holds import (
        lock_trip_boats_for_ticket_items,
        trip_boat_pairs_from_booking,
        validate_capacity_for_booking_lines,
    )

    try:
        booking = get_booking_with_items(session, confirmation_code)

        if booking.booking_status != BookingStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot confirm free booking with status '{booking.booking_status}'",
            )

        if booking.total_amount >= 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirm-free-booking is only for zero-total or sub-minimum (under 50 cents) bookings",
            )

        pairs = trip_boat_pairs_from_booking(booking)
        lock_trip_boats_for_ticket_items(session=session, trip_boat_pairs=pairs)
        validate_capacity_for_booking_lines(
            session=session,
            booking=booking,
            exclude_booking_id=None,
        )

        booking.booking_status = BookingStatus.confirmed
        booking.payment_status = PaymentStatus.free
        booking.capacity_hold_expires_at = None
        session.add(booking)
        session.commit()
        session.refresh(booking)

        send_booking_confirmation_email(session, booking)

        return {"status": "confirmed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error confirming free booking {confirmation_code}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm free booking",
        )
