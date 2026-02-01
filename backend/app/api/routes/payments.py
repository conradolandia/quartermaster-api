import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from app.api import deps
from app.core.config import settings
from app.core.stripe import (
    create_payment_intent,
    retrieve_payment_intent,
)
from app.models import Booking, BookingStatus, Mission, Trip
from app.utils import generate_booking_confirmation_email, send_email

from .booking_utils import generate_qr_code

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


def send_booking_confirmation_email(session: Session, booking: Booking) -> None:
    """Send booking confirmation email to the customer."""
    logger.info(
        "send_booking_confirmation_email called: booking_id=%s confirmation_code=%s user_email=%s",
        booking.id,
        booking.confirmation_code,
        booking.user_email,
    )
    if not settings.emails_enabled:
        logger.warning(
            "Booking confirmation email skipped: emails disabled (set SMTP_HOST and EMAILS_FROM_EMAIL to enable)"
        )
        return

    try:
        # Get mission name from the first booking item's trip
        if not booking.items:
            logger.warning(
                "Booking confirmation email skipped: booking %s has no items",
                booking.confirmation_code,
            )
            return

        first_trip = session.get(Trip, booking.items[0].trip_id)
        if not first_trip:
            logger.warning(
                "Booking confirmation email skipped: trip_id %s not found for booking %s",
                booking.items[0].trip_id,
                booking.confirmation_code,
            )
            return

        mission = session.get(Mission, first_trip.mission_id)
        mission_name = mission.name if mission else "Space Mission"

        # Prepare booking items for email (price in dollars for display)
        booking_items = []
        for item in booking.items:
            booking_items.append(
                {
                    "type": item.item_type.replace("_", " ").title(),
                    "quantity": item.quantity,
                    "price_per_unit": item.price_per_unit / 100.0,
                }
            )

        # Get or generate QR code for the email
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
        )

        send_email(
            email_to=booking.user_email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
        logger.info(
            "Booking confirmation email sent to %s for %s",
            booking.user_email,
            booking.confirmation_code,
        )

    except Exception as e:
        # Log error but don't fail the booking process
        logger.error(
            f"Failed to send booking confirmation email for booking {booking.id}: {str(e)}"
        )


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
    logger.info(
        "verify_payment: payment_intent_id=%s status=%s booking=%s booking_status=%s",
        payment_intent_id,
        payment_intent.status,
        booking.confirmation_code,
        booking.status,
    )
    if payment_intent.status == "succeeded":
        # Check if booking is already confirmed to prevent duplicate processing
        if booking.status == BookingStatus.confirmed:
            logger.info(
                f"Booking {booking.confirmation_code} already confirmed, skipping duplicate processing"
            )
            return {"status": "succeeded", "booking_status": "confirmed"}

        booking.status = BookingStatus.confirmed
        session.add(booking)
        session.commit()
        session.refresh(booking)

        # Send booking confirmation email
        send_booking_confirmation_email(session, booking)

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
        # Check if booking is already cancelled to prevent duplicate processing
        if booking.status == BookingStatus.cancelled:
            logger.info(
                f"Booking {booking.confirmation_code} already cancelled, skipping duplicate processing"
            )
            return {"status": "canceled", "booking_status": "cancelled"}

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
    logger.info("Stripe webhook received: event.type=%s", event.type)
    if event.type == "payment_intent.succeeded":
        payment_intent = event.data.object
        logger.info(
            "payment_intent.succeeded: pi_id=%s",
            payment_intent.id,
        )
        booking = (
            session.query(Booking)
            .filter(Booking.payment_intent_id == payment_intent.id)
            .first()
        )

        if booking:
            # Check if booking is already confirmed to prevent duplicate processing
            if booking.status == BookingStatus.confirmed:
                logger.info(
                    "Webhook: Booking %s already confirmed, skipping duplicate processing",
                    booking.confirmation_code,
                )
                return {"status": "success"}

            booking.status = BookingStatus.confirmed
            session.add(booking)
            session.commit()
            session.refresh(booking)
            logger.info(
                "Webhook: booking %s confirmed, sending confirmation email",
                booking.confirmation_code,
            )
            # Send booking confirmation email
            send_booking_confirmation_email(session, booking)
        else:
            logger.warning(
                "Webhook: payment_intent.succeeded for pi_id=%s but no booking found",
                payment_intent.id,
            )

    elif event.type == "payment_intent.payment_failed":
        payment_intent = event.data.object
        booking = (
            session.query(Booking)
            .filter(Booking.payment_intent_id == payment_intent.id)
            .first()
        )

        if booking:
            # Check if booking is already cancelled to prevent duplicate processing
            if booking.status == BookingStatus.cancelled:
                logger.info(
                    f"Webhook: Booking {booking.confirmation_code} already cancelled, skipping duplicate processing"
                )
                return {"status": "success"}

            booking.status = BookingStatus.cancelled
            session.add(booking)
            session.commit()

    return {"status": "success"}
