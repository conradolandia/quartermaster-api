"""Trip-scoped bulk refund helpers."""

import logging
import uuid
from dataclasses import dataclass

from sqlmodel import Session, select

from app.crud.booking_items import get_paid_ticket_count_per_boat_for_trip
from app.crud.trips import get_trip_sales_cents
from app.models import Booking, BookingItem, BookingStatus, PaymentStatus
from app.services.refund import RefundProcessingError, process_booking_refund

logger = logging.getLogger(__name__)

TRIP_REFUND_BOOKING_STATUSES = (
    BookingStatus.confirmed,
    BookingStatus.checked_in,
    BookingStatus.completed,
)

SKIP_REASON_LABELS: dict[str, str] = {
    "checked_in": "Checked in",
    "completed": "Completed",
    "partially_refunded": "Partially refunded",
    "already_refunded": "Already refunded",
    "not_paid": "Payment not paid",
    "no_stripe": "No Stripe payment",
}


@dataclass
class TripRefundBookingRow:
    confirmation_code: str
    booking_status: str
    payment_status: str | None
    refund_amount_cents: int
    skip_reason: str | None = None


@dataclass
class TripRefundPreview:
    eligible: list[TripRefundBookingRow]
    skipped: list[TripRefundBookingRow]
    trip_sales_cents: int
    committed_passengers: int


def trip_bookings_for_refund_preview_query(trip_id: uuid.UUID):
    """Distinct bookings on a trip in the same lifecycle states as trip sales stats."""
    return (
        select(Booking)
        .join(BookingItem, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(Booking.booking_status.in_(TRIP_REFUND_BOOKING_STATUSES))
        .distinct()
    )


def classify_booking_for_trip_bulk_refund(booking: Booking) -> str | None:
    """
    Return a skip_reason key when the booking is not eligible, else None.
    Eligible: confirmed, paid, Stripe payment, no prior refund.
    """
    if booking.booking_status == BookingStatus.checked_in:
        return "checked_in"
    if booking.booking_status == BookingStatus.completed:
        return "completed"
    refunded_so_far = getattr(booking, "refunded_amount_cents", 0) or 0
    if (
        booking.payment_status == PaymentStatus.partially_refunded
        or refunded_so_far > 0
    ):
        return "partially_refunded"
    if booking.payment_status == PaymentStatus.refunded:
        return "already_refunded"
    if booking.payment_status != PaymentStatus.paid:
        return "not_paid"
    if not (booking.payment_intent_id or "").strip():
        return "no_stripe"
    if booking.booking_status == BookingStatus.confirmed:
        return None
    return "not_paid"


def remaining_refundable_cents(booking: Booking) -> int:
    refunded_so_far = getattr(booking, "refunded_amount_cents", 0) or 0
    return max(0, booking.total_amount - refunded_so_far)


def get_trip_refund_preview(
    *, session: Session, trip_id: uuid.UUID
) -> TripRefundPreview:
    bookings = list(session.exec(trip_bookings_for_refund_preview_query(trip_id)).all())
    eligible: list[TripRefundBookingRow] = []
    skipped: list[TripRefundBookingRow] = []

    for booking in bookings:
        amount = remaining_refundable_cents(booking)
        row = TripRefundBookingRow(
            confirmation_code=booking.confirmation_code,
            booking_status=booking.booking_status.value,
            payment_status=(
                booking.payment_status.value if booking.payment_status else None
            ),
            refund_amount_cents=amount,
        )
        skip_reason = classify_booking_for_trip_bulk_refund(booking)
        if skip_reason is None and amount > 0:
            eligible.append(row)
        else:
            row.skip_reason = skip_reason or "not_paid"
            skipped.append(row)

    paid_counts = get_paid_ticket_count_per_boat_for_trip(
        session=session, trip_id=trip_id
    )
    return TripRefundPreview(
        eligible=eligible,
        skipped=skipped,
        trip_sales_cents=get_trip_sales_cents(session=session, trip_id=trip_id),
        committed_passengers=sum(paid_counts.values()),
    )


def trip_refundable_bookings_query(trip_id: uuid.UUID):
    """Bookings eligible for trip bulk refund (confirmed, paid, Stripe, no prior refund)."""
    return (
        select(Booking)
        .join(BookingItem, Booking.id == BookingItem.booking_id)
        .where(BookingItem.trip_id == trip_id)
        .where(Booking.booking_status == BookingStatus.confirmed)
        .where(Booking.payment_status == PaymentStatus.paid)
        .where(Booking.payment_intent_id.isnot(None))  # type: ignore[union-attr]
        .where(Booking.payment_intent_id != "")
        .where(Booking.refunded_amount_cents == 0)
        .distinct()
    )


def get_trip_refundable_bookings(
    *, session: Session, trip_id: uuid.UUID
) -> list[Booking]:
    return list(session.exec(trip_refundable_bookings_query(trip_id)).all())


def refund_trip_paid_bookings(
    *,
    session: Session,
    trip_id: uuid.UUID,
    refund_reason: str,
    refund_notes: str | None = None,
) -> tuple[list[Booking], list[tuple[str, str]]]:
    """
    Fully refund all eligible bookings on a trip. Continues on failure.

    Returns (refunded_bookings, failures as (confirmation_code, detail) pairs).
    """
    bookings = get_trip_refundable_bookings(session=session, trip_id=trip_id)
    refunded: list[Booking] = []
    failures: list[tuple[str, str]] = []

    for booking in bookings:
        try:
            updated = process_booking_refund(
                session,
                booking,
                refund_reason=refund_reason,
                refund_notes=refund_notes,
                refund_amount_cents=None,
                allowed_booking_statuses=(BookingStatus.confirmed,),
                require_payment_intent=True,
            )
            refunded.append(updated)
        except RefundProcessingError as e:
            session.rollback()
            failures.append((booking.confirmation_code, e.detail))
        except Exception as e:
            session.rollback()
            failures.append(
                (
                    booking.confirmation_code,
                    "An unexpected error occurred during refund processing.",
                )
            )
            logger.exception(
                "Unexpected error refunding booking %s on trip %s: %s",
                booking.confirmation_code,
                trip_id,
                str(e),
            )

    return refunded, failures
