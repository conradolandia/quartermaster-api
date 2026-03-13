"""Tests for admin booking item endpoints (booking_admin_items.py)."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingItem,
    BookingStatus,
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


def test_add_booking_item_400_when_checked_in(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_boat: Boat,
) -> None:
    test_booking.booking_status = BookingStatus.checked_in
    db.add(test_booking)
    db.commit()
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
    assert r.status_code == 400
    assert "checked-in" in r.json().get("detail", "").lower()


def test_add_booking_item_400_merchandise_not_supported(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_trip: Trip,
    test_boat: Boat,
) -> None:
    payload = {
        "trip_id": str(test_trip.id),
        "boat_id": str(test_boat.id),
        "item_type": "adult",
        "quantity": 1,
        "price_per_unit": 5000,
        "trip_merchandise_id": str(uuid.uuid4()),
    }
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 400
    assert "merchandise" in r.json().get("detail", "").lower()


def test_add_booking_item_400_boat_not_on_trip(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_provider,
) -> None:
    other_boat = Boat(
        name="Other Vessel",
        slug="other-vessel",
        capacity=20,
        provider_id=test_provider.id,
    )
    db.add(other_boat)
    db.commit()
    db.refresh(other_boat)
    payload = {
        "trip_id": str(test_trip.id),
        "boat_id": str(other_boat.id),
        "item_type": "adult",
        "quantity": 1,
        "price_per_unit": 5000,
    }
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 400
    assert "not on this trip" in r.json().get("detail", "").lower()


def test_add_booking_item_400_ticket_type_not_available(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_trip: Trip,
    test_trip_boat: TripBoat,
) -> None:
    """Use trip_boat.boat_id so boat is on trip; only item_type is invalid."""
    payload = {
        "trip_id": str(test_trip.id),
        "boat_id": str(test_trip_boat.boat_id),
        "item_type": "nonexistent_type",
        "quantity": 1,
        "price_per_unit": 5000,
    }
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 400
    assert "not available" in r.json().get("detail", "").lower()


def test_update_booking_item_400_no_data(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items/{test_booking_item.id}",
        headers=superuser_token_headers,
        json={},
    )
    assert r.status_code == 400
    assert "No update" in r.json().get("detail", "")


def test_update_booking_item_404_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    """Use a nonexistent booking_id; item belongs to test_booking so we get 404 on booking."""
    fake_booking_id = uuid.uuid4()
    while fake_booking_id == test_booking.id:
        fake_booking_id = uuid.uuid4()
    r = client.patch(
        f"{BOOKINGS_URL}/id/{fake_booking_id}/items/{test_booking_item.id}",
        headers=superuser_token_headers,
        json={"refund_reason": "test"},
    )
    assert r.status_code == 404


def test_update_booking_item_404_item_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    """Use a nonexistent item_id so we get 404 on item."""
    fake_item_id = uuid.uuid4()
    while fake_item_id == test_booking_item.id:
        fake_item_id = uuid.uuid4()
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items/{fake_item_id}",
        headers=superuser_token_headers,
        json={"refund_reason": "test"},
    )
    assert r.status_code == 404


def test_update_booking_item_success_refund_reason(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    """BookingItemUpdate supports refund_reason, refund_notes, status, item_type, price_per_unit, boat_id (not quantity)."""
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}/items/{test_booking_item.id}",
        headers=superuser_token_headers,
        json={"refund_reason": "Customer request"},
    )
    assert r.status_code == 200
    data = r.json()
    assert any(i.get("refund_reason") == "Customer request" for i in data["items"])
