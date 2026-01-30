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
from app.models import Booking, BookingStatus

ALLOWED_CLEANUP_STATUSES = {
    BookingStatus.draft,
    BookingStatus.pending_payment,
    BookingStatus.cancelled,
}
CANCEL_STATUSES = {BookingStatus.draft, BookingStatus.pending_payment}
DELETE_STATUSES = {BookingStatus.cancelled}


def parse_statuses(value: str) -> list[BookingStatus]:
    statuses = [BookingStatus(s.strip()) for s in value.split(",") if s.strip()]
    invalid = [s for s in statuses if s not in ALLOWED_CLEANUP_STATUSES]
    if invalid:
        raise argparse.ArgumentTypeError(
            f"Status(es) not allowed for cleanup: {[s.value for s in invalid]}. "
            f"Allowed: {[s.value for s in ALLOWED_CLEANUP_STATUSES]}"
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
    hours=0: no age filter (process all matching statuses). Use for one-off full cleanup.
    Returns (cancelled_count, deleted_count).
    """
    if statuses is None:
        statuses = [BookingStatus.draft, BookingStatus.pending_payment]
    session = next(deps.get_db())
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours) if hours > 0 else now

    to_cancel = [s for s in statuses if s in CANCEL_STATUSES]
    to_delete = [s for s in statuses if s in DELETE_STATUSES]
    cancelled_count = 0
    deleted_count = 0

    try:
        if to_cancel:
            stmt = select(Booking).where(Booking.status.in_(to_cancel))
            if hours > 0:
                stmt = stmt.where(Booking.created_at < cutoff)
            for booking in session.exec(stmt).all():
                old_status = booking.status
                booking.status = BookingStatus.cancelled
                session.add(booking)
                cancelled_count += 1
                print(f"Cancel: {booking.confirmation_code} (was {old_status})")

        if to_delete:
            # hours=0 means "any age" for delete (all cancelled)
            stmt = select(Booking).where(Booking.status.in_(to_delete))
            if hours > 0:
                stmt = stmt.where(Booking.created_at < cutoff)
            for booking in session.exec(stmt).all():
                deleted_count += 1
                print(f"Delete: {booking.confirmation_code} (was {booking.status})")
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
  Cancel abandoned draft/pending_payment (default, 24h):
    python scripts/cleanup_abandoned_drafts.py

  Cancel draft/pending_payment and delete cancelled, 48h:
    python scripts/cleanup_abandoned_drafts.py --statuses draft,pending_payment,cancelled --hours 48

  Delete only cancelled older than 168h (1 week):
    python scripts/cleanup_abandoned_drafts.py --statuses cancelled --hours 168

  Cancel ALL draft/pending_payment and delete ALL cancelled (any age):
    python scripts/cleanup_abandoned_drafts.py --statuses draft,pending_payment,cancelled --hours 0

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
        help="Comma-separated statuses to clean. Cancel: draft, pending_payment. Delete: cancelled. Default: draft,pending_payment.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without changing the DB",
    )
    args = parser.parse_args()
    cleanup_bookings(hours=args.hours, statuses=args.statuses, dry_run=args.dry_run)
