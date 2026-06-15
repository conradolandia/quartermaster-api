"""Shared booking refund processing."""

import logging
import uuid
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

REFUNDABLE_ITEM_STATUSES: tuple[BookingItemStatus, ...] = (
    BookingItemStatus.active,
    BookingItemStatus.fulfilled,
)


def compute_line_item_refund_cents(item: BookingItem, booking: Booking) -> int:
    """
    Refund amount for one line item: proportional share of discount and tax (no tip).
    """
    item_subtotal = item.price_per_unit * item.quantity
    if item_subtotal <= 0 or booking.subtotal <= 0:
        return 0

    after_discount_subtotal = max(0, booking.subtotal - booking.discount_amount)
    item_after_discount = round(
        item_subtotal * after_discount_subtotal / booking.subtotal
    )
    if after_discount_subtotal <= 0:
        return item_after_discount

    item_tax = round(booking.tax_amount * item_after_discount / after_discount_subtotal)
    return item_after_discount + item_tax


def _restore_merchandise_inventory_for_item(
    session: Session, item: BookingItem
) -> None:
    if not item.merchandise_variation_id:
        return
    variation = session.get(MerchandiseVariation, item.merchandise_variation_id)
    if not variation:
        return
    was_fulfilled = item.status == BookingItemStatus.fulfilled
    variation.quantity_sold -= item.quantity
    variation.quantity_sold = max(0, variation.quantity_sold)
    if was_fulfilled:
        variation.quantity_fulfilled -= item.quantity
        variation.quantity_fulfilled = max(0, variation.quantity_fulfilled)
    session.add(variation)


def _mark_item_refunded(
    *,
    item: BookingItem,
    refund_reason: str,
    refund_notes: str | None,
    refunded_amount_cents: int,
) -> None:
    item.status = BookingItemStatus.refunded
    item.refunded_amount_cents = refunded_amount_cents
    item.refund_reason = refund_reason
    item.refund_notes = refund_notes


def process_booking_refund(
    session: Session,
    booking: Booking,
    *,
    refund_reason: str,
    refund_notes: str | None = None,
    refund_amount_cents: int | None = None,
    refund_item_ids: Sequence[uuid.UUID] | None = None,
    allowed_booking_statuses: Sequence[
        BookingStatus
    ] = DEFAULT_REFUNDABLE_BOOKING_STATUSES,
    require_payment_intent: bool = False,
) -> Booking:
    """
    Process a refund for a booking: Stripe (when payment_intent_id exists),
    update booking/items/inventory, and send confirmation email.

    When refund_item_ids is set, refunds those line items (amount computed from
    item price + proportional tax). Otherwise refund_amount_cents controls the
    flat amount (full remaining balance when omitted).
    """
    if booking.booking_status not in allowed_booking_statuses:
        allowed = ", ".join(s.value for s in allowed_booking_statuses)
        raise RefundProcessingError(
            f"Cannot refund booking with status '{booking.booking_status.value}'. "
            f"Booking must be one of: {allowed}."
        )

    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()

    refunded_so_far = getattr(booking, "refunded_amount_cents", 0) or 0
    remaining_refundable = booking.total_amount - refunded_so_far
    if remaining_refundable <= 0:
        raise RefundProcessingError("No remaining amount to refund for this booking.")

    items_to_refund: list[BookingItem] = []
    if refund_item_ids is not None:
        if not refund_item_ids:
            raise RefundProcessingError("At least one line item must be selected.")
        if refund_amount_cents is not None:
            raise RefundProcessingError(
                "Specify either refund_item_ids or refund_amount_cents, not both."
            )
        item_by_id = {item.id: item for item in items}
        seen: set[uuid.UUID] = set()
        for item_id in refund_item_ids:
            if item_id in seen:
                continue
            seen.add(item_id)
            item = item_by_id.get(item_id)
            if item is None:
                raise RefundProcessingError(
                    f"Line item {item_id} does not belong to this booking."
                )
            if item.status == BookingItemStatus.refunded:
                raise RefundProcessingError(
                    f"Line item '{item.item_type}' has already been refunded."
                )
            if item.status not in REFUNDABLE_ITEM_STATUSES:
                raise RefundProcessingError(
                    f"Line item '{item.item_type}' cannot be refunded "
                    f"(status: {item.status.value})."
                )
            items_to_refund.append(item)

        amount_to_refund = sum(
            compute_line_item_refund_cents(item, booking) for item in items_to_refund
        )
        if amount_to_refund <= 0:
            raise RefundProcessingError(
                "Selected line items have no refundable amount."
            )
    else:
        amount_to_refund = (
            refund_amount_cents
            if refund_amount_cents is not None
            else remaining_refundable
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
        "process_booking_refund reason=%r notes=%r booking=%s amount_cents=%s item_ids=%s",
        refund_reason,
        refund_notes,
        booking.confirmation_code,
        amount_to_refund,
        [str(i.id) for i in items_to_refund] if items_to_refund else None,
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

    if items_to_refund:
        for item in items_to_refund:
            item_refund_cents = compute_line_item_refund_cents(item, booking)
            _mark_item_refunded(
                item=item,
                refund_reason=refund_reason,
                refund_notes=refund_notes,
                refunded_amount_cents=item_refund_cents,
            )
            session.add(item)
            _restore_merchandise_inventory_for_item(session, item)
    elif amount_to_refund >= remaining_refundable:
        for item in items:
            if item.status != BookingItemStatus.refunded:
                item_refund_cents = compute_line_item_refund_cents(item, booking)
                _mark_item_refunded(
                    item=item,
                    refund_reason=refund_reason,
                    refund_notes=refund_notes,
                    refunded_amount_cents=item_refund_cents,
                )
                session.add(item)
                _restore_merchandise_inventory_for_item(session, item)
    else:
        for item in items:
            item.refund_reason = refund_reason
            item.refund_notes = refund_notes
            session.add(item)

    fully_refunded = booking.refunded_amount_cents >= booking.total_amount
    all_items_refunded = items and all(
        item.status == BookingItemStatus.refunded for item in items
    )

    if fully_refunded or all_items_refunded:
        booking.booking_status = BookingStatus.cancelled
        booking.payment_status = PaymentStatus.refunded
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
