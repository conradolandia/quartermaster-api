#!/usr/bin/env python3
"""
Audit and fix date coherence violations in the database.

This script:
1. Audits all launches, missions, trips, and bookings for date violations
2. Auto-fixes obvious violations (time ordering issues)
3. Generates a CSV report of all violations and fixes
"""

import csv
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select

from app.core.db import engine
from app.models import Booking, BookingItem, Launch, Mission, Trip

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_now() -> datetime:
    """Get current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (assumes UTC if naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def audit_launches(session: Session, now: datetime) -> list[dict[str, Any]]:
    """Audit launches for past timestamps."""
    violations = []
    launches = session.exec(select(Launch)).unique().all()
    for launch in launches:
        launch_time = ensure_aware(launch.launch_timestamp)
        if launch_time < now:
            violations.append(
                {
                    "entity_type": "Launch",
                    "entity_id": str(launch.id),
                    "entity_name": launch.name,
                    "violation_type": "past_launch",
                    "description": f"Launch timestamp {launch_time} is in the past",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )
    return violations


def audit_missions(session: Session, now: datetime) -> list[dict[str, Any]]:
    """Audit missions for date violations."""
    violations = []
    missions = session.exec(select(Mission)).unique().all()
    for mission in missions:
        # Get launch
        launch = session.get(Launch, mission.launch_id)
        if not launch:
            violations.append(
                {
                    "entity_type": "Mission",
                    "entity_id": str(mission.id),
                    "entity_name": mission.name,
                    "violation_type": "missing_launch",
                    "description": "Mission references non-existent launch",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )
            continue

        # Check if launch is past
        launch_time = ensure_aware(launch.launch_timestamp)
        if launch_time < now:
            violations.append(
                {
                    "entity_type": "Mission",
                    "entity_id": str(mission.id),
                    "entity_name": mission.name,
                    "violation_type": "past_launch",
                    "description": f"Mission's launch {launch_time} is in the past",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )

        # Check sales_open_at coherence
        if mission.sales_open_at:
            sales_time = ensure_aware(mission.sales_open_at)
            launch_time = ensure_aware(launch.launch_timestamp)
            if sales_time >= launch_time:
                violations.append(
                    {
                        "entity_type": "Mission",
                        "entity_id": str(mission.id),
                        "entity_name": mission.name,
                        "violation_type": "sales_open_after_launch",
                        "description": f"sales_open_at {sales_time} is after launch {launch_time}",
                        "auto_fixable": False,
                        "fixed": False,
                    }
                )

    return violations


def audit_trips(session: Session, now: datetime) -> list[dict[str, Any]]:
    """Audit trips for date violations."""
    violations = []
    trips = session.exec(select(Trip)).unique().all()
    for trip in trips:
        # Check time ordering
        check_in = ensure_aware(trip.check_in_time)
        boarding = ensure_aware(trip.boarding_time)
        departure = ensure_aware(trip.departure_time)

        if check_in > boarding:
            violations.append(
                {
                    "entity_type": "Trip",
                    "entity_id": str(trip.id),
                    "entity_name": trip.type,
                    "violation_type": "time_ordering",
                    "description": f"check_in_time {check_in} > boarding_time {boarding}",
                    "auto_fixable": True,
                    "fixed": False,
                }
            )

        if boarding > departure:
            violations.append(
                {
                    "entity_type": "Trip",
                    "entity_id": str(trip.id),
                    "entity_name": trip.type,
                    "violation_type": "time_ordering",
                    "description": f"boarding_time {boarding} > departure_time {departure}",
                    "auto_fixable": True,
                    "fixed": False,
                }
            )

        # Check if trip is past
        if departure < now:
            violations.append(
                {
                    "entity_type": "Trip",
                    "entity_id": str(trip.id),
                    "entity_name": trip.type,
                    "violation_type": "past_trip",
                    "description": f"departure_time {departure} is in the past",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )

        # Get mission and launch for coherence check
        mission = session.get(Mission, trip.mission_id)
        if not mission:
            violations.append(
                {
                    "entity_type": "Trip",
                    "entity_id": str(trip.id),
                    "entity_name": trip.type,
                    "violation_type": "missing_mission",
                    "description": "Trip references non-existent mission",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )
            continue

        launch = session.get(Launch, mission.launch_id)
        if not launch:
            continue

        # For launch_viewing and pre_launch, departure should typically be before launch
        # But we allow post-launch trips, so we'll just log if it's unusual
        if trip.type in ("launch_viewing", "pre_launch"):
            launch_time = ensure_aware(launch.launch_timestamp)
            if departure > launch_time:
                # This is allowed but unusual - we'll note it but not flag as violation
                pass

    return violations


def audit_bookings(session: Session, now: datetime) -> list[dict[str, Any]]:
    """Audit bookings for date violations."""
    violations = []
    bookings = session.exec(select(Booking)).unique().all()
    for booking in bookings:
        # Get first booking item to find trip
        booking_item = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id).limit(1)
        ).first()

        if not booking_item:
            continue

        trip = session.get(Trip, booking_item.trip_id)
        if not trip:
            violations.append(
                {
                    "entity_type": "Booking",
                    "entity_id": str(booking.id),
                    "entity_name": booking.confirmation_code,
                    "violation_type": "missing_trip",
                    "description": "Booking references non-existent trip",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )
            continue

        # Check if trip is past
        trip_departure = ensure_aware(trip.departure_time)
        if trip_departure < now:
            violations.append(
                {
                    "entity_type": "Booking",
                    "entity_id": str(booking.id),
                    "entity_name": booking.confirmation_code,
                    "violation_type": "past_trip",
                    "description": f"Booking is for a trip that has already departed ({trip_departure})",
                    "auto_fixable": False,
                    "fixed": False,
                }
            )

    return violations


def auto_fix_time_ordering(session: Session, violations: list[dict[str, Any]]) -> int:
    """Auto-fix time ordering violations by swapping times."""
    fixed_count = 0
    for violation in violations:
        if not violation["auto_fixable"] or violation["fixed"]:
            continue

        if violation["violation_type"] != "time_ordering":
            continue

        trip_id = violation["entity_id"]
        trip = session.get(Trip, trip_id)
        if not trip:
            continue

        # Ensure timezone-aware for comparison
        check_in = ensure_aware(trip.check_in_time)
        boarding = ensure_aware(trip.boarding_time)
        departure = ensure_aware(trip.departure_time)

        # Fix check_in > boarding
        if check_in > boarding:
            trip.check_in_time, trip.boarding_time = (
                trip.boarding_time,
                trip.check_in_time,
            )
            violation["fixed"] = True
            violation["fix_description"] = "Swapped check_in_time and boarding_time"
            fixed_count += 1

        # Fix boarding > departure
        if boarding > departure:
            trip.boarding_time, trip.departure_time = (
                trip.departure_time,
                trip.boarding_time,
            )
            violation["fixed"] = True
            violation["fix_description"] = "Swapped boarding_time and departure_time"
            fixed_count += 1

        if violation["fixed"]:
            session.add(trip)

    if fixed_count > 0:
        session.commit()
        logger.info(f"Auto-fixed {fixed_count} time ordering violations")

    return fixed_count


def generate_report(violations: list[dict[str, Any]], output_path: Path) -> None:
    """Generate CSV report of violations."""
    if not violations:
        logger.info("No violations found. No report generated.")
        return

    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "entity_type",
                "entity_id",
                "entity_name",
                "violation_type",
                "description",
                "auto_fixable",
                "fixed",
                "fix_description",
            ],
        )
        writer.writeheader()
        for violation in violations:
            row = violation.copy()
            row["fix_description"] = violation.get("fix_description", "")
            writer.writerow(row)

    logger.info(f"Report generated: {output_path}")


def main() -> None:
    """Main audit and fix function."""
    logger.info("Starting date coherence audit...")
    now = get_now()
    logger.info(f"Current time (UTC): {now}")

    violations: list[dict[str, Any]] = []

    with Session(engine) as session:
        logger.info("Auditing launches...")
        violations.extend(audit_launches(session, now))

        logger.info("Auditing missions...")
        violations.extend(audit_missions(session, now))

        logger.info("Auditing trips...")
        violations.extend(audit_trips(session, now))

        logger.info("Auditing bookings...")
        violations.extend(audit_bookings(session, now))

        logger.info(f"Found {len(violations)} total violations")

        # Auto-fix time ordering violations
        logger.info("Attempting to auto-fix violations...")
        fixed_count = auto_fix_time_ordering(session, violations)

        logger.info(f"Auto-fixed {fixed_count} violations")

    # Generate report
    report_path = Path(__file__).parent.parent / "date_audit_report.csv"
    generate_report(violations, report_path)

    logger.info("Audit complete!")
    logger.info(f"Total violations: {len(violations)}")
    logger.info(f"Auto-fixed: {fixed_count}")
    logger.info(f"Requiring manual review: {len(violations) - fixed_count}")


if __name__ == "__main__":
    main()
