"""Discount code persistence helpers."""

from sqlmodel import Session

from app.models import Booking, DiscountCode


def increment_used_count_for_booking(session: Session, booking: Booking) -> None:
    """Increment ``used_count`` when a booking is confirmed with a discount/access code.

    Idempotent with respect to booking state: callers must invoke only when transitioning
    into a confirmed paid/free state (not when the booking was already confirmed).
    """
    if not booking.discount_code_id:
        return
    discount_code = session.get(DiscountCode, booking.discount_code_id)
    if discount_code is None:
        return
    discount_code.used_count += 1
    session.add(discount_code)
