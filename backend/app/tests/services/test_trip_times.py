"""
Tests for app.services.trip_times module.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.trip_times import (
    TRIP_TYPE_OFFSET_DEFAULTS,
    compute_trip_times_from_departure_and_offsets,
    get_default_offsets_for_type,
)


class TestGetDefaultOffsetsForType:
    """Tests for get_default_offsets_for_type function."""

    def test_launch_viewing_returns_expected_offsets(self) -> None:
        boarding, checkin = get_default_offsets_for_type("launch_viewing")
        assert boarding == 30
        assert checkin == 30

    def test_pre_launch_returns_expected_offsets(self) -> None:
        boarding, checkin = get_default_offsets_for_type("pre_launch")
        assert boarding == 15
        assert checkin == 15

    def test_unknown_type_returns_default_offsets(self) -> None:
        boarding, checkin = get_default_offsets_for_type("unknown_type")
        assert boarding == 30
        assert checkin == 30

    def test_empty_string_returns_default_offsets(self) -> None:
        boarding, checkin = get_default_offsets_for_type("")
        assert boarding == 30
        assert checkin == 30

    @pytest.mark.parametrize(
        "trip_type,expected",
        [
            ("launch_viewing", (30, 30)),
            ("pre_launch", (15, 15)),
            ("post_launch", (30, 30)),
            ("charter", (30, 30)),
        ],
    )
    def test_various_trip_types(
        self, trip_type: str, expected: tuple[int, int]
    ) -> None:
        result = get_default_offsets_for_type(trip_type)
        assert result == expected

    def test_all_defined_types_are_in_defaults_dict(self) -> None:
        assert "launch_viewing" in TRIP_TYPE_OFFSET_DEFAULTS
        assert "pre_launch" in TRIP_TYPE_OFFSET_DEFAULTS


class TestComputeTripTimesFromDepartureAndOffsets:
    """Tests for compute_trip_times_from_departure_and_offsets function."""

    def test_basic_time_calculation(self) -> None:
        departure = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)
        boarding_offset = 30
        checkin_offset = 30

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(
            departure, boarding_offset, checkin_offset
        )

        assert result_departure == departure
        assert boarding == datetime(2025, 6, 15, 9, 30, 0, tzinfo=timezone.utc)
        assert check_in == datetime(2025, 6, 15, 9, 0, 0, tzinfo=timezone.utc)

    def test_different_offsets(self) -> None:
        departure = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        boarding_offset = 45
        checkin_offset = 15

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(
            departure, boarding_offset, checkin_offset
        )

        assert result_departure == departure
        assert boarding == datetime(2025, 6, 15, 11, 15, 0, tzinfo=timezone.utc)
        assert check_in == datetime(2025, 6, 15, 11, 0, 0, tzinfo=timezone.utc)

    def test_zero_offsets(self) -> None:
        departure = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(departure, 0, 0)

        assert check_in == departure
        assert boarding == departure
        assert result_departure == departure

    def test_naive_datetime_becomes_utc(self) -> None:
        departure = datetime(2025, 6, 15, 10, 0, 0)  # naive
        boarding_offset = 30
        checkin_offset = 30

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(
            departure, boarding_offset, checkin_offset
        )

        assert result_departure.tzinfo == timezone.utc
        assert boarding.tzinfo == timezone.utc
        assert check_in.tzinfo == timezone.utc

    def test_large_offsets_cross_day_boundary(self) -> None:
        departure = datetime(2025, 6, 15, 1, 0, 0, tzinfo=timezone.utc)
        boarding_offset = 60
        checkin_offset = 60

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(
            departure, boarding_offset, checkin_offset
        )

        assert result_departure == departure
        assert boarding == datetime(2025, 6, 15, 0, 0, 0, tzinfo=timezone.utc)
        assert check_in == datetime(2025, 6, 14, 23, 0, 0, tzinfo=timezone.utc)

    def test_time_ordering_is_correct(self) -> None:
        departure = datetime(2025, 6, 15, 10, 0, 0, tzinfo=timezone.utc)

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(departure, 30, 30)

        assert check_in <= boarding <= result_departure

    @pytest.mark.parametrize(
        "boarding_offset,checkin_offset",
        [
            (15, 15),
            (30, 30),
            (45, 15),
            (60, 30),
            (120, 60),
        ],
    )
    def test_various_offset_combinations(
        self, boarding_offset: int, checkin_offset: int
    ) -> None:
        departure = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

        (
            check_in,
            boarding,
            result_departure,
        ) = compute_trip_times_from_departure_and_offsets(
            departure, boarding_offset, checkin_offset
        )

        expected_boarding = departure - timedelta(minutes=boarding_offset)
        expected_checkin = expected_boarding - timedelta(minutes=checkin_offset)

        assert result_departure == departure
        assert boarding == expected_boarding
        assert check_in == expected_checkin
