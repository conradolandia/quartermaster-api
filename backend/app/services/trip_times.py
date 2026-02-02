"""
Compute trip check-in and boarding times from departure and minute offsets.
"""

from datetime import datetime, timedelta

from app.services.date_validator import ensure_aware

# Default offsets by trip type: (boarding_minutes_before_departure, checkin_minutes_before_boarding)
TRIP_TYPE_OFFSET_DEFAULTS: dict[str, tuple[int, int]] = {
    "launch_viewing": (30, 30),
    "pre_launch": (15, 15),
}


def get_default_offsets_for_type(trip_type: str) -> tuple[int, int]:
    """Return (boarding_minutes_before_departure, checkin_minutes_before_boarding) for the trip type."""
    return TRIP_TYPE_OFFSET_DEFAULTS.get(trip_type, (30, 30))


def compute_trip_times_from_departure_and_offsets(
    departure_time: datetime,
    boarding_minutes_before_departure: int,
    checkin_minutes_before_boarding: int,
) -> tuple[datetime, datetime, datetime]:
    """
    Compute check_in_time and boarding_time from departure_time and minute offsets.

    Returns (check_in_time, boarding_time, departure_time).
    """
    departure_time = ensure_aware(departure_time)
    boarding_time = departure_time - timedelta(
        minutes=boarding_minutes_before_departure
    )
    check_in_time = boarding_time - timedelta(minutes=checkin_minutes_before_boarding)
    return (check_in_time, boarding_time, departure_time)
