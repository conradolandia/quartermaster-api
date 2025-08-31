#!/usr/bin/env python3
"""
Cleanup script to remove duplicate bookings.

This script identifies and removes duplicate bookings, keeping only the confirmed ones
and removing pending/cancelled duplicates for the same customer and timestamp.
"""

from sqlmodel import select

from app.api import deps
from app.models import Booking, BookingStatus


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

                # Sort by status priority: confirmed > pending_payment > cancelled > draft
                status_priority = {
                    BookingStatus.confirmed: 1,
                    BookingStatus.pending_payment: 2,
                    BookingStatus.cancelled: 3,
                    BookingStatus.draft: 4,
                }

                bookings.sort(key=lambda b: status_priority.get(b.status, 999))

                # Keep the first one (highest priority status)
                keep_booking = bookings[0]
                kept_bookings.append(keep_booking)
                print(
                    f"  KEEPING: {keep_booking.confirmation_code} ({keep_booking.status})"
                )

                # Mark others for deletion
                for booking in bookings[1:]:
                    to_delete.append(booking)
                    print(f"  DELETING: {booking.confirmation_code} ({booking.status})")

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
                    f"  {booking.confirmation_code}: {booking.status} - {booking.user_email}"
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
