#!/usr/bin/env python3
"""
Cleanup script to remove duplicate bookings.

This script identifies and removes duplicate bookings, keeping only the confirmed ones
and removing pending/cancelled duplicates for the same customer and timestamp.
"""

from sqlmodel import select

from app.api import deps
from app.models import Booking, BookingStatus, PaymentStatus


def _booking_priority(b: Booking) -> int:
    """Priority for keeping: confirmed/checked_in/completed > draft+pending_payment > cancelled > draft."""
    if b.booking_status in (
        BookingStatus.confirmed,
        BookingStatus.checked_in,
        BookingStatus.completed,
    ):
        return 1
    if (
        b.booking_status == BookingStatus.draft
        and b.payment_status == PaymentStatus.pending_payment
    ):
        return 2
    if b.booking_status == BookingStatus.cancelled:
        return 3
    return 4  # draft, no payment


def cleanup_duplicate_bookings():
    """Clean up duplicate bookings by keeping only confirmed ones."""
    session = next(deps.get_db())

    try:
        # Get all bookings ordered by creation time
        all_bookings = session.exec(
            select(Booking).order_by(Booking.created_at.desc())
        ).all()

        # Group bookings by customer email and creation time (within 5 seconds)
        duplicates = {}
        for booking in all_bookings:
            key = (booking.user_email, booking.created_at.replace(microsecond=0))
            if key not in duplicates:
                duplicates[key] = []
            duplicates[key].append(booking)

        # Find groups with multiple bookings
        to_delete = []
        kept_bookings = []

        for (email, created_at), bookings in duplicates.items():
            if len(bookings) > 1:
                print(f"\nFound {len(bookings)} bookings for {email} at {created_at}:")

                bookings.sort(key=_booking_priority)

                # Keep the first one (highest priority status)
                keep_booking = bookings[0]
                kept_bookings.append(keep_booking)
                print(
                    f"  KEEPING: {keep_booking.confirmation_code} ({keep_booking.booking_status}, {keep_booking.payment_status})"
                )

                # Mark others for deletion
                for booking in bookings[1:]:
                    to_delete.append(booking)
                    print(
                        f"  DELETING: {booking.confirmation_code} ({booking.booking_status}, {booking.payment_status})"
                    )

        if to_delete:
            print(f"\nDeleting {len(to_delete)} duplicate bookings...")

            # Delete duplicate bookings
            for booking in to_delete:
                session.delete(booking)

            session.commit()
            print("Cleanup completed successfully!")

            # Show final state
            print(f"\nKept {len(kept_bookings)} bookings:")
            for booking in kept_bookings:
                print(
                    f"  {booking.confirmation_code}: {booking.booking_status} - {booking.user_email}"
                )
        else:
            print("No duplicate bookings found.")

    except Exception as e:
        print(f"Error during cleanup: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    cleanup_duplicate_bookings()
