"""
Payment-related booking endpoints.

This module contains booking endpoints that handle payment operations,
such as initializing payments for draft bookings.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api import deps
from app.core.stripe import create_payment_intent
from app.models import Booking, BookingStatus

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


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
