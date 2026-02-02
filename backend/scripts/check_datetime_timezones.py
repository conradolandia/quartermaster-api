#!/usr/bin/env python3
"""
Diagnostic script to check if datetime fields in the database are timezone-naive or timezone-aware.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select

from app.core.db import engine
from app.models import Booking, Launch, Mission, Trip

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger(__name__)


def check_datetime_field(
    value: datetime | None, field_name: str, entity_id: str
) -> dict:
    """Check if a datetime field is naive or aware."""
    if value is None:
        return {
            "field": field_name,
            "value": None,
            "is_naive": None,
            "is_aware": None,
            "tzinfo": None,
        }

    is_naive = value.tzinfo is None
    is_aware = value.tzinfo is not None

    return {
        "field": field_name,
        "value": value.isoformat(),
        "is_naive": is_naive,
        "is_aware": is_aware,
        "tzinfo": str(value.tzinfo) if value.tzinfo else None,
        "entity_id": entity_id,
    }


def check_launches(session: Session) -> list[dict]:
    """Check datetime fields in launches."""
    logger.info("Checking launches...")
    launches = session.exec(select(Launch)).unique().all()
    results = []

    for launch in launches:
        results.append(
            check_datetime_field(
                launch.launch_timestamp, "launch_timestamp", str(launch.id)
            )
        )
        results.append(
            check_datetime_field(launch.created_at, "created_at", str(launch.id))
        )
        if launch.updated_at:
            results.append(
                check_datetime_field(launch.updated_at, "updated_at", str(launch.id))
            )

    return results


def check_missions(session: Session) -> list[dict]:
    """Check datetime fields in missions."""
    logger.info("Checking missions...")
    missions = session.exec(select(Mission)).unique().all()
    results = []

    for mission in missions:
        results.append(
            check_datetime_field(mission.created_at, "created_at", str(mission.id))
        )
        if mission.updated_at:
            results.append(
                check_datetime_field(mission.updated_at, "updated_at", str(mission.id))
            )

    return results


def check_trips(session: Session) -> list[dict]:
    """Check datetime fields in trips."""
    logger.info("Checking trips...")
    trips = session.exec(select(Trip)).unique().all()
    results = []

    for trip in trips:
        results.append(
            check_datetime_field(trip.check_in_time, "check_in_time", str(trip.id))
        )
        results.append(
            check_datetime_field(trip.boarding_time, "boarding_time", str(trip.id))
        )
        results.append(
            check_datetime_field(trip.departure_time, "departure_time", str(trip.id))
        )
        results.append(
            check_datetime_field(trip.created_at, "created_at", str(trip.id))
        )
        if trip.updated_at:
            results.append(
                check_datetime_field(trip.updated_at, "updated_at", str(trip.id))
            )

    return results


def check_bookings(session: Session) -> list[dict]:
    """Check datetime fields in bookings."""
    logger.info("Checking bookings...")
    bookings = session.exec(select(Booking)).unique().all()
    results = []

    for booking in bookings:
        results.append(
            check_datetime_field(booking.created_at, "created_at", str(booking.id))
        )
        if booking.updated_at:
            results.append(
                check_datetime_field(booking.updated_at, "updated_at", str(booking.id))
            )

    return results


def generate_summary(results: list[dict]) -> dict:
    """Generate a summary of timezone awareness."""
    summary = {
        "total_fields": len(results),
        "naive_count": 0,
        "aware_count": 0,
        "null_count": 0,
        "by_entity_type": {},
        "by_field_name": {},
    }

    for result in results:
        field_name = result["field"]

        # Determine entity type from field name
        if "launch_timestamp" in field_name:
            entity_type = "Launch"
        elif "sales_open_at" in field_name:
            entity_type = "Trip"
        elif any(
            x in field_name
            for x in ["check_in_time", "boarding_time", "departure_time"]
        ):
            entity_type = "Trip"
        elif "created_at" in field_name or "updated_at" in field_name:
            # Try to infer from context - for now, just use field name
            entity_type = "Generic"
        else:
            entity_type = "Booking"

        # Count by awareness
        if result["is_naive"] is True:
            summary["naive_count"] += 1
        elif result["is_aware"] is True:
            summary["aware_count"] += 1
        else:
            summary["null_count"] += 1

        # Count by entity type
        if entity_type not in summary["by_entity_type"]:
            summary["by_entity_type"][entity_type] = {"naive": 0, "aware": 0, "null": 0}

        if result["is_naive"] is True:
            summary["by_entity_type"][entity_type]["naive"] += 1
        elif result["is_aware"] is True:
            summary["by_entity_type"][entity_type]["aware"] += 1
        else:
            summary["by_entity_type"][entity_type]["null"] += 1

        # Count by field name
        if field_name not in summary["by_field_name"]:
            summary["by_field_name"][field_name] = {"naive": 0, "aware": 0, "null": 0}

        if result["is_naive"] is True:
            summary["by_field_name"][field_name]["naive"] += 1
        elif result["is_aware"] is True:
            summary["by_field_name"][field_name]["aware"] += 1
        else:
            summary["by_field_name"][field_name]["null"] += 1

    return summary


def main():
    """Main function."""
    logger.info("Starting datetime timezone diagnostic...")

    with Session(engine) as session:
        all_results = []

        # Check all entity types
        all_results.extend(check_launches(session))
        all_results.extend(check_missions(session))
        all_results.extend(check_trips(session))
        all_results.extend(check_bookings(session))

        # Generate summary
        summary = generate_summary(all_results)

        # Print summary
        logger.info("\n" + "=" * 80)
        logger.info("SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total datetime fields checked: {summary['total_fields']}")
        logger.info(f"Timezone-naive: {summary['naive_count']}")
        logger.info(f"Timezone-aware: {summary['aware_count']}")
        logger.info(f"Null values: {summary['null_count']}")

        logger.info("\n" + "-" * 80)
        logger.info("By Entity Type:")
        logger.info("-" * 80)
        for entity_type, counts in summary["by_entity_type"].items():
            logger.info(
                f"{entity_type}: naive={counts['naive']}, aware={counts['aware']}, null={counts['null']}"
            )

        logger.info("\n" + "-" * 80)
        logger.info("By Field Name:")
        logger.info("-" * 80)
        for field_name, counts in sorted(summary["by_field_name"].items()):
            logger.info(
                f"{field_name}: naive={counts['naive']}, aware={counts['aware']}, null={counts['null']}"
            )

        # Print detailed results for naive datetimes (the problematic ones)
        logger.info("\n" + "=" * 80)
        logger.info("DETAILED RESULTS - TIMEZONE-NAIVE DATETIMES (PROBLEMATIC)")
        logger.info("=" * 80)
        naive_results = [r for r in all_results if r["is_naive"] is True]
        if naive_results:
            for result in naive_results:
                logger.info(
                    f"Entity ID: {result.get('entity_id', 'unknown')}, "
                    f"Field: {result['field']}, "
                    f"Value: {result['value']}, "
                    f"tzinfo: {result['tzinfo']}"
                )
        else:
            logger.info("No timezone-naive datetimes found - all are timezone-aware!")

        # Print sample of aware datetimes
        logger.info("\n" + "=" * 80)
        logger.info("SAMPLE - TIMEZONE-AWARE DATETIMES (FIRST 5)")
        logger.info("=" * 80)
        aware_results = [r for r in all_results if r["is_aware"] is True][:5]
        for result in aware_results:
            logger.info(
                f"Entity ID: {result.get('entity_id', 'unknown')}, "
                f"Field: {result['field']}, "
                f"Value: {result['value']}, "
                f"tzinfo: {result['tzinfo']}"
            )

    logger.info("\nDiagnostic complete!")


if __name__ == "__main__":
    main()
