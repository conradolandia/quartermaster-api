from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from app.api import deps
from app.core.stripe import (
    create_payment_intent,
    retrieve_payment_intent,
)
from app.models import Booking, BookingStatus

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/create-payment-intent")
def create_payment_intent_endpoint(
    amount: int,
    currency: str = "usd",
) -> dict:
    """
    Create a Stripe PaymentIntent for the specified amount.

    Args:
        amount: Amount in cents (e.g., 1000 for $10.00)
        currency: Currency code (default: "usd")

    Returns:
        dict: Payment intent client secret and ID
    """
    payment_intent = create_payment_intent(amount, currency)
    return {
        "client_secret": payment_intent.client_secret,
        "payment_intent_id": payment_intent.id,
    }


@router.post("/verify-payment/{payment_intent_id}")
def verify_payment(
    *,
    session: Session = Depends(deps.get_db),
    payment_intent_id: str,
) -> dict:
    """
    Verify a payment intent's status.

    Args:
        payment_intent_id: The ID of the payment intent to verify

    Returns:
        dict: Payment status information
    """
    payment_intent = retrieve_payment_intent(payment_intent_id)

    # Find the booking associated with this payment intent
    booking = (
        session.query(Booking)
        .filter(Booking.payment_intent_id == payment_intent_id)
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No booking found for this payment intent",
        )

    # Update booking status based on payment intent status
    if payment_intent.status == "succeeded":
        booking.status = BookingStatus.confirmed
        session.add(booking)
        session.commit()
        return {"status": "succeeded", "booking_status": "confirmed"}
    elif payment_intent.status == "requires_payment_method":
        return {"status": "requires_payment_method"}
    elif payment_intent.status == "requires_confirmation":
        return {"status": "requires_confirmation"}
    elif payment_intent.status == "requires_action":
        return {"status": "requires_action"}
    elif payment_intent.status == "processing":
        return {"status": "processing"}
    elif payment_intent.status == "requires_capture":
        return {"status": "requires_capture"}
    elif payment_intent.status == "canceled":
        booking.status = BookingStatus.cancelled
        session.add(booking)
        session.commit()
        return {"status": "canceled", "booking_status": "cancelled"}
    else:
        return {"status": payment_intent.status}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    session: Session = Depends(deps.get_db),
) -> dict:
    """
    Handle Stripe webhook events.

    Args:
        request: The incoming webhook request

    Returns:
        dict: Status of the webhook processing
    """

    import stripe

    from app.core.config import settings

    # Get the webhook secret from settings
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )

    # Get the webhook payload
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        # Verify the webhook signature
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload",
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    # Handle the event
    if event.type == "payment_intent.succeeded":
        payment_intent = event.data.object
        booking = (
            session.query(Booking)
            .filter(Booking.payment_intent_id == payment_intent.id)
            .first()
        )

        if booking:
            booking.status = BookingStatus.confirmed
            session.add(booking)
            session.commit()

    elif event.type == "payment_intent.payment_failed":
        payment_intent = event.data.object
        booking = (
            session.query(Booking)
            .filter(Booking.payment_intent_id == payment_intent.id)
            .first()
        )

        if booking:
            booking.status = BookingStatus.cancelled
            session.add(booking)
            session.commit()

    return {"status": "success"}
