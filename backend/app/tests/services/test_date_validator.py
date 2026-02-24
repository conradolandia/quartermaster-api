"""
Tests for app.services.date_validator module.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.services.date_validator import (
    TRIP_EDITABLE_HOURS_AFTER_DEPARTURE,
    effective_booking_mode,
    ensure_aware,
    is_launch_past,
    is_trip_past,
    is_trip_past_editable_window,
    validate_trip_dates,
    validate_trip_time_ordering,
)


class TestEnsureAware:
    """Tests for ensure_aware function."""

    def test_naive_datetime_becomes_utc(self) -> None:
        naive = datetime(2025, 6, 15, 10, 30, 0)
        result = ensure_aware(naive)
        assert result.tzinfo == timezone.utc
        assert result.year == 2025
        assert result.month == 6
        assert result.day == 15
        assert result.hour == 10
        assert result.minute == 30

    def test_aware_datetime_unchanged(self) -> None:
        aware = datetime(2025, 6, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = ensure_aware(aware)
        assert result == aware
        assert result.tzinfo == timezone.utc

    def test_different_timezone_preserved(self) -> None:
        eastern = timezone(timedelta(hours=-5))
        aware = datetime(2025, 6, 15, 10, 30, 0, tzinfo=eastern)
        result = ensure_aware(aware)
        assert result == aware
        assert result.tzinfo == eastern


class TestEffectiveBookingMode:
    """Tests for effective_booking_mode function."""

    def test_no_sales_open_at_returns_stored_mode(self) -> None:
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        assert effective_booking_mode("private", None, now) == "private"
        assert effective_booking_mode("early_bird", None, now) == "early_bird"
        assert effective_booking_mode("public", None, now) == "public"

    def test_before_sales_open_returns_stored_mode(self) -> None:
        sales_open = datetime(2025, 6, 20, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        assert effective_booking_mode("private", sales_open, now) == "private"
        assert effective_booking_mode("early_bird", sales_open, now) == "early_bird"
        assert effective_booking_mode("public", sales_open, now) == "public"

    def test_after_sales_open_bumps_mode(self) -> None:
        sales_open = datetime(2025, 6, 10, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        assert effective_booking_mode("private", sales_open, now) == "early_bird"
        assert effective_booking_mode("early_bird", sales_open, now) == "public"
        assert effective_booking_mode("public", sales_open, now) == "public"

    def test_at_sales_open_bumps_mode(self) -> None:
        sales_open = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert effective_booking_mode("private", sales_open, now) == "early_bird"

    def test_invalid_mode_defaults_to_private(self) -> None:
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        assert effective_booking_mode("invalid", None, now) == "private"
        assert effective_booking_mode("", None, now) == "private"


class TestIsLaunchPast:
    """Tests for is_launch_past function."""

    def test_past_launch(self) -> None:
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 10, 10, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_launch_past(launch, now) is True

    def test_future_launch(self) -> None:
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 20, 10, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_launch_past(launch, now) is False

    def test_launch_at_exact_time(self) -> None:
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_launch_past(launch, now) is False

    def test_launch_with_naive_datetime(self) -> None:
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 10, 10, 0, 0)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_launch_past(launch, now) is True


class TestIsTripPast:
    """Tests for is_trip_past function."""

    def test_past_trip(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 10, 8, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_trip_past(trip, now) is True

    def test_future_trip(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 20, 8, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_trip_past(trip, now) is False

    def test_trip_at_exact_departure_time(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_trip_past(trip, now) is False


class TestIsTripPastEditableWindow:
    """Tests for is_trip_past_editable_window function."""

    def test_within_editable_window(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 20, 0, 0, tzinfo=timezone.utc)
        assert is_trip_past_editable_window(trip, now) is False

    def test_past_editable_window(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        now = trip.departure_time + timedelta(
            hours=TRIP_EDITABLE_HOURS_AFTER_DEPARTURE + 1
        )
        assert is_trip_past_editable_window(trip, now) is True

    def test_at_editable_window_boundary(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        now = trip.departure_time + timedelta(hours=TRIP_EDITABLE_HOURS_AFTER_DEPARTURE)
        assert is_trip_past_editable_window(trip, now) is False

    def test_before_departure_is_editable(self) -> None:
        trip = MagicMock()
        trip.departure_time = datetime(2025, 6, 20, 8, 0, 0, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert is_trip_past_editable_window(trip, now) is False


class TestValidateTripTimeOrdering:
    """Tests for validate_trip_time_ordering function."""

    def test_valid_time_ordering(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 6, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_time_ordering(trip)
        assert is_valid is True
        assert error_msg is None

    def test_equal_times_are_valid(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_time_ordering(trip)
        assert is_valid is True
        assert error_msg is None

    def test_check_in_after_boarding_invalid(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 7, 30, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_time_ordering(trip)
        assert is_valid is False
        assert "Check-in time must be before or equal to boarding time" in error_msg

    def test_boarding_after_departure_invalid(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 6, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 9, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_time_ordering(trip)
        assert is_valid is False
        assert "Boarding time must be before or equal to departure time" in error_msg


class TestValidateTripDates:
    """Tests for validate_trip_dates function."""

    def test_valid_trip_dates(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 6, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.type = "launch_viewing"
        trip.sales_open_at = datetime(2025, 6, 1, 0, 0, 0, tzinfo=timezone.utc)

        mission = MagicMock()
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_dates(trip, mission, launch)
        assert is_valid is True
        assert error_msg is None

    def test_sales_open_after_departure_invalid(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 6, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.type = "launch_viewing"
        trip.sales_open_at = datetime(2025, 6, 20, 0, 0, 0, tzinfo=timezone.utc)

        mission = MagicMock()
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_dates(trip, mission, launch)
        assert is_valid is False
        assert "Sales open date must be before departure time" in error_msg

    def test_sales_open_equals_departure_invalid(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 6, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.type = "launch_viewing"
        trip.sales_open_at = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)

        mission = MagicMock()
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_dates(trip, mission, launch)
        assert is_valid is False
        assert "Sales open date must be before departure time" in error_msg

    def test_no_sales_open_at_is_valid(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 6, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.type = "launch_viewing"
        trip.sales_open_at = None

        mission = MagicMock()
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_dates(trip, mission, launch)
        assert is_valid is True
        assert error_msg is None

    def test_invalid_time_ordering_fails(self) -> None:
        trip = MagicMock()
        trip.check_in_time = datetime(2025, 6, 15, 9, 0, 0, tzinfo=timezone.utc)
        trip.boarding_time = datetime(2025, 6, 15, 7, 0, 0, tzinfo=timezone.utc)
        trip.departure_time = datetime(2025, 6, 15, 8, 0, 0, tzinfo=timezone.utc)
        trip.type = "launch_viewing"
        trip.sales_open_at = None

        mission = MagicMock()
        launch = MagicMock()
        launch.launch_timestamp = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        is_valid, error_msg = validate_trip_dates(trip, mission, launch)
        assert is_valid is False
        assert "Check-in time must be before or equal to boarding time" in error_msg
