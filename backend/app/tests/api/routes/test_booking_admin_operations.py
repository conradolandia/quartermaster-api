"""Tests for admin booking operations (booking_admin_operations.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Booking, BookingItem, Trip

BOOKINGS_URL = f"{settings.API_V1_STR}/bookings"


def test_reschedule_requires_auth(
    client: TestClient,
    test_booking: Booking,
    test_trip: Trip,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        json={"target_trip_id": str(test_trip.id)},
    )
    assert r.status_code == 401


def test_reschedule_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/id/{uuid.uuid4()}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(test_trip.id)},
    )
    assert r.status_code == 404


def test_reschedule_target_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(uuid.uuid4())},
    )
    assert r.status_code == 404


def test_check_in_requires_auth(
    client: TestClient,
    test_booking: Booking,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/check-in/{test_booking.confirmation_code}",
    )
    assert r.status_code == 401


def test_check_in_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/check-in/NONEXISTENT",
        headers=superuser_token_headers,
    )
    assert r.status_code in (400, 404)
