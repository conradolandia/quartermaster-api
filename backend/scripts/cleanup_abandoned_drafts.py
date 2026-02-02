#!/usr/bin/env python3
"""
Clean up bookings by status and age.

- draft / pending_payment: set status to cancelled (abandoned drafts).
- cancelled: delete from DB (items cascade).

Run periodically (e.g. cron). Default: cancel draft and pending_payment older than 24h.
"""

import argparse
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from app.api import deps
from app.models import Booking, BookingStatus, PaymentStatus

ALLOWED_CLEANUP_STATUSES = {
    BookingStatus.draft,
    BookingStatus.cancelled,
}
CANCEL_BOOKING_STATUS = (
    BookingStatus.draft
)  # cancel draft (covers no payment + pending payment)
DELETE_BOOKING_STATUS = BookingStatus.cancelled


def parse_statuses(value: str) -> list[BookingStatus]:
    statuses = [BookingStatus(s.strip()) for s in value.split(",") if s.strip()]
    invalid = [s for s in statuses if s not in ALLOWED_CLEANUP_STATUSES]
    if invalid:
        raise argparse.ArgumentTypeError(
            f"Status(es) not allowed for cleanup: {[s.value for s in invalid]}. "
            f"Allowed: draft, cancelled"
        )
    return statuses


def cleanup_bookings(
    *,
    hours: int = 24,
    statuses: list[BookingStatus] | None = None,
    dry_run: bool = False,
) -> tuple[int, int]:
    """
    Cancel or delete bookings with the given statuses older than `hours`.
    Cancel: booking_status=draft (abandoned drafts). Delete: booking_status=cancelled.
    hours=0: no age filter. Returns (cancelled_count, deleted_count).
    """
    if statuses is None:
        statuses = [BookingStatus.draft]
    session = next(deps.get_db())
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours) if hours > 0 else now

    to_cancel = [s for s in statuses if s == CANCEL_BOOKING_STATUS]
    to_delete = [s for s in statuses if s == DELETE_BOOKING_STATUS]
    cancelled_count = 0
    deleted_count = 0

    try:
        if to_cancel:
            stmt = select(Booking).where(
                Booking.booking_status == CANCEL_BOOKING_STATUS
            )
            if hours > 0:
                stmt = stmt.where(Booking.created_at < cutoff)
            for booking in session.exec(stmt).all():
                old_status = booking.booking_status
                booking.booking_status = BookingStatus.cancelled
                booking.payment_status = PaymentStatus.failed
                session.add(booking)
                cancelled_count += 1
                print(f"Cancel: {booking.confirmation_code} (was {old_status})")

        if to_delete:
            stmt = select(Booking).where(
                Booking.booking_status == DELETE_BOOKING_STATUS
            )
            if hours > 0:
                stmt = stmt.where(Booking.created_at < cutoff)
            for booking in session.exec(stmt).all():
                deleted_count += 1
                print(
                    f"Delete: {booking.confirmation_code} (was {booking.booking_status})"
                )
                session.delete(booking)

        if cancelled_count or deleted_count:
            if not dry_run:
                session.commit()
                print(f"Cancelled {cancelled_count}, deleted {deleted_count}.")
            else:
                print(
                    f"[dry run] Would cancel {cancelled_count}, delete {deleted_count}."
                )
        else:
            print("No matching bookings found.")

        return cancelled_count, deleted_count
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Clean up bookings by status and age.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Cancel abandoned draft (default, 24h):
    python scripts/cleanup_abandoned_drafts.py

  Cancel draft and delete cancelled, 48h:
    python scripts/cleanup_abandoned_drafts.py --statuses draft,cancelled --hours 48

  Delete only cancelled older than 168h (1 week):
    python scripts/cleanup_abandoned_drafts.py --statuses cancelled --hours 168

  Cancel ALL draft and delete ALL cancelled (any age):
    python scripts/cleanup_abandoned_drafts.py --statuses draft,cancelled --hours 0

  Delete ALL cancelled (any age):
    python scripts/cleanup_abandoned_drafts.py --statuses cancelled --hours 0

  Dry run (no DB changes):
    python scripts/cleanup_abandoned_drafts.py --statuses cancelled --dry-run
""",
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Process bookings older than this many hours (default: 24). Use 0 for any age (full cleanup).",
    )
    parser.add_argument(
        "--statuses",
        type=parse_statuses,
        default=None,
        metavar="STATUS[,STATUS,...]",
        help="Comma-separated statuses to clean. Cancel: draft. Delete: cancelled. Default: draft.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without changing the DB",
    )
    args = parser.parse_args()
    cleanup_bookings(hours=args.hours, statuses=args.statuses, dry_run=args.dry_run)
