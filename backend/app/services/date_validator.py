"""
Date validation utilities for ensuring coherence across Launch → Mission → Trip → Booking hierarchy.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlmodel import Session

    from app.models import Booking, Launch, Mission, Trip


def _get_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    """
    Ensure datetime is timezone-aware (assumes UTC if naive).

    Args:
        dt: Datetime to ensure is timezone-aware

    Returns:
        Timezone-aware datetime (UTC if originally naive)
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def is_launch_past(launch: "Launch", now: datetime | None = None) -> bool:
    """
    Check if a launch has already occurred.

    Args:
        launch: Launch instance to check
        now: Optional datetime to use as reference (defaults to current UTC time)

    Returns:
        True if launch_timestamp is in the past, False otherwise
    """
    if now is None:
        now = _get_now()
    return launch.launch_timestamp < now


def is_mission_past(mission: "Mission", session: "Session") -> bool:
    """
    Check if a mission's launch has already occurred.

    Args:
        mission: Mission instance to check
        session: Database session to fetch launch

    Returns:
        True if the mission's launch has occurred, False otherwise
    """
    from app import crud

    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        return False
    return is_launch_past(launch)


def is_trip_past(trip: "Trip", now: datetime | None = None) -> bool:
    """
    Check if a trip has already departed.

    Args:
        trip: Trip instance to check
        now: Optional datetime to use as reference (defaults to current UTC time)

    Returns:
        True if departure_time is in the past, False otherwise
    """
    if now is None:
        now = _get_now()
    return trip.departure_time < now


def is_booking_past(booking: "Booking", session: "Session") -> bool:
    """
    Check if a booking's trip has already departed.

    Args:
        booking: Booking instance to check
        session: Database session to fetch trip

    Returns:
        True if the booking's trip has departed, False otherwise
    """
    from sqlmodel import select

    from app import crud
    from app.models import BookingItem

    # Get first booking item to find the trip
    booking_item = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id).limit(1)
    ).first()

    if not booking_item:
        return False

    trip = crud.get_trip(session=session, trip_id=booking_item.trip_id)
    if not trip:
        return False

    return is_trip_past(trip)


def validate_mission_dates(
    mission: "Mission", launch: "Launch"
) -> tuple[bool, str | None]:
    """
    Validate that mission dates are coherent with launch dates.

    Args:
        mission: Mission instance to validate
        launch: Launch instance associated with the mission

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if dates are valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    if mission.sales_open_at is not None:
        if mission.sales_open_at >= launch.launch_timestamp:
            return (
                False,
                "Sales open date must be before launch timestamp",
            )

    return (True, None)


def validate_trip_time_ordering(trip: "Trip") -> tuple[bool, str | None]:
    """
    Validate that trip times are in correct order: check_in <= boarding <= departure.

    Args:
        trip: Trip instance to validate

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if times are valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    if trip.check_in_time > trip.boarding_time:
        return (
            False,
            "Check-in time must be before or equal to boarding time",
        )

    if trip.boarding_time > trip.departure_time:
        return (
            False,
            "Boarding time must be before or equal to departure time",
        )

    return (True, None)


def validate_trip_dates(
    trip: "Trip", mission: "Mission", launch: "Launch"
) -> tuple[bool, str | None]:
    """
    Validate that trip dates are coherent with mission and launch dates.

    Args:
        trip: Trip instance to validate
        mission: Mission instance associated with the trip (currently unused, reserved for future validations)
        launch: Launch instance associated with the mission

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if dates are valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    # First validate time ordering
    is_valid, error_msg = validate_trip_time_ordering(trip)
    if not is_valid:
        return (False, error_msg)

    # For launch_viewing and pre_launch trips, departure should typically be before launch
    # But post-launch trips are allowed (special cases)
    # We'll allow both but log if departure is after launch for launch_viewing/pre_launch
    if trip.type in ("launch_viewing", "pre_launch"):
        if trip.departure_time > launch.launch_timestamp:
            # This is allowed but might be unusual - we'll allow it but could log a warning
            pass

    # Mission parameter is reserved for future validations (e.g., checking sales_open_at)
    _ = mission  # Suppress unused parameter warning

    return (True, None)


def validate_booking_dates(booking: "Booking", trip: "Trip") -> tuple[bool, str | None]:
    """
    Validate that booking dates are coherent with trip dates.

    Args:
        booking: Booking instance to validate
        trip: Trip instance associated with the booking

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if dates are valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    now = _get_now()

    # Booking should be for a future trip
    if trip.departure_time < now:
        return (
            False,
            "Cannot create booking for a trip that has already departed",
        )

    # Booking created_at should be before trip departure (logical check)
    if booking.created_at > trip.departure_time:
        # This is unusual but not necessarily invalid (could be a data correction)
        # We'll allow it but could log a warning
        pass

    return (True, None)
