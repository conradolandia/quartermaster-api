"""Shared booking refund processing."""

import logging
from collections.abc import Sequence

from sqlmodel import Session, select

from app.models import (
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    MerchandiseVariation,
    Mission,
    PaymentStatus,
    Trip,
)
from app.utils import send_email

logger = logging.getLogger(__name__)


class RefundProcessingError(Exception):
    """Refund could not be completed for a single booking."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


DEFAULT_REFUNDABLE_BOOKING_STATUSES: tuple[BookingStatus, ...] = (
    BookingStatus.confirmed,
    BookingStatus.checked_in,
    BookingStatus.completed,
)


def process_booking_refund(
    session: Session,
    booking: Booking,
    *,
    refund_reason: str,
    refund_notes: str | None = None,
    refund_amount_cents: int | None = None,
    allowed_booking_statuses: Sequence[
        BookingStatus
    ] = DEFAULT_REFUNDABLE_BOOKING_STATUSES,
    require_payment_intent: bool = False,
) -> Booking:
    """
    Process a refund for a booking: Stripe (when payment_intent_id exists),
    update booking/items/inventory, and send confirmation email.
    """
    if booking.booking_status not in allowed_booking_statuses:
        allowed = ", ".join(s.value for s in allowed_booking_statuses)
        raise RefundProcessingError(
            f"Cannot refund booking with status '{booking.booking_status.value}'. "
            f"Booking must be one of: {allowed}."
        )

    refunded_so_far = getattr(booking, "refunded_amount_cents", 0) or 0
    remaining_refundable = booking.total_amount - refunded_so_far
    if remaining_refundable <= 0:
        raise RefundProcessingError("No remaining amount to refund for this booking.")

    amount_to_refund = (
        refund_amount_cents if refund_amount_cents is not None else remaining_refundable
    )
    if amount_to_refund > remaining_refundable:
        raise RefundProcessingError(
            f"Refund amount cannot exceed remaining refundable amount "
            f"(${remaining_refundable / 100:.2f})."
        )
    if amount_to_refund <= 0:
        raise RefundProcessingError("Refund amount must be positive.")

    payment_intent_id = (booking.payment_intent_id or "").strip()
    if require_payment_intent and not payment_intent_id:
        raise RefundProcessingError(
            "Booking has no Stripe payment and cannot be refunded through this action."
        )

    logger.info(
        "process_booking_refund reason=%r notes=%r booking=%s amount_cents=%s",
        refund_reason,
        refund_notes,
        booking.confirmation_code,
        amount_to_refund,
    )

    if payment_intent_id:
        try:
            from app.core.stripe import refund_payment

            refund = refund_payment(payment_intent_id, amount_to_refund)
            logger.info(
                "Stripe refund processed: %s for booking %s",
                refund.id,
                booking.confirmation_code,
            )
        except Exception as e:
            logger.error(
                "Stripe refund failed for booking %s: %s",
                booking.confirmation_code,
                str(e),
            )
            raise RefundProcessingError(
                f"Failed to process Stripe refund: {str(e)}"
            ) from e
    else:
        logger.warning(
            "No payment intent for booking %s; processing refund without Stripe",
            booking.confirmation_code,
        )

    booking.refunded_amount_cents = refunded_so_far + amount_to_refund
    booking.refund_reason = refund_reason
    booking.refund_notes = refund_notes
    session.add(booking)

    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()

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
        booking.payment_status = PaymentStatus.partially_refunded

    session.commit()
    session.refresh(booking)

    try:
        from app.utils import generate_booking_refunded_email

        mission_name = "Unknown Mission"
        first_item = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).first()
        if first_item:
            trip = session.get(Trip, first_item.trip_id)
            if trip:
                mission = session.get(Mission, trip.mission_id)
                if mission:
                    mission_name = mission.name

        email_data = generate_booking_refunded_email(
            email_to=booking.user_email,
            user_name=f"{booking.first_name} {booking.last_name}".strip(),
            confirmation_code=booking.confirmation_code,
            mission_name=mission_name,
            refund_amount=amount_to_refund / 100.0,
            refund_reason=booking.refund_reason,
        )
        send_email(
            email_to=booking.user_email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
        logger.info("Refund confirmation email sent to %s", booking.user_email)
    except Exception as e:
        logger.error(
            "Failed to send refund email for booking %s: %s",
            booking.confirmation_code,
            str(e),
        )

    return booking
