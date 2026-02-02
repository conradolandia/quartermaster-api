"""
Payment-related booking endpoints.

This module contains booking endpoints that handle payment operations,
such as initializing payments for draft bookings.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api import deps
from app.core.stripe import create_payment_intent, retrieve_payment_intent
from app.models import Booking, BookingStatus, PaymentStatus

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
        if booking.booking_status != BookingStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot initialize payment for booking with booking status '{booking.booking_status}'",
            )

        # Check if PaymentIntent already exists
        if booking.payment_intent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment already initialized for this booking",
            )

        # Booking total_amount is already in cents
        total_amount_cents = booking.total_amount

        # Create PaymentIntent
        payment_intent = create_payment_intent(total_amount_cents)

        # Update booking with PaymentIntent ID and payment status (booking_status stays draft)
        booking.payment_intent_id = payment_intent.id
        booking.payment_status = PaymentStatus.pending_payment

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


@router.get("/{confirmation_code}/resume-payment")
def resume_payment(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> dict:
    """
    Return existing PaymentIntent client_secret for a pending_payment booking.
    Allows resuming payment without creating a new booking or PaymentIntent.
    """
    try:
        booking = session.exec(
            select(Booking).where(Booking.confirmation_code == confirmation_code)
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found",
            )

        if (
            booking.booking_status != BookingStatus.draft
            or booking.payment_status != PaymentStatus.pending_payment
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot resume payment for booking with booking_status '{booking.booking_status}' and payment_status '{booking.payment_status}'",
            )

        if not booking.payment_intent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No payment intent for this booking",
            )

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
