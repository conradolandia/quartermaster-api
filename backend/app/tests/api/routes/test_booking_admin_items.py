"""Tests for admin booking item endpoints (booking_admin_items.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingItem,
    Trip,
    TripBoat,
    TripBoatPricing,
)

BOOKINGS_URL = f"{settings.API_V1_STR}/bookings"


def test_add_booking_item_requires_auth(
    client: TestClient, test_booking: Booking
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items",
        json={
            "trip_id": str(uuid.uuid4()),
            "boat_id": str(uuid.uuid4()),
            "item_type": "adult",
            "quantity": 1,
            "price_per_unit": 5000,
        },
    )
    assert r.status_code == 401


def test_add_booking_item_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_boat: Boat,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
    test_trip_boat_pricing: TripBoatPricing,
) -> None:
    """Add a second ticket item (same trip/boat) to an existing booking."""
    payload = {
        "trip_id": str(test_trip.id),
        "boat_id": str(test_boat.id),
        "item_type": "adult",
        "quantity": 1,
        "price_per_unit": 5000,
    }
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    data = r.json()
    assert len(data["items"]) >= 2
    assert any(i["item_type"] == "adult" for i in data["items"])


def test_add_booking_item_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat: Boat,
) -> None:
    payload = {
        "trip_id": str(test_trip.id),
        "boat_id": str(test_boat.id),
        "item_type": "adult",
        "quantity": 1,
        "price_per_unit": 5000,
    }
    r = client.post(
        f"{BOOKINGS_URL}/id/{uuid.uuid4()}/items",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 404


def test_add_booking_item_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_boat: Boat,
) -> None:
    payload = {
        "trip_id": str(uuid.uuid4()),
        "boat_id": str(test_boat.id),
        "item_type": "adult",
        "quantity": 1,
        "price_per_unit": 5000,
    }
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 404
