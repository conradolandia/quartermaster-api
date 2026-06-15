"""Tests for launches API routes (launches.py)."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    Launch,
    Location,
    PaymentStatus,
    Provider,
    Trip,
    TripBoat,
)

LAUNCHES_URL = f"{settings.API_V1_STR}/launches"


def test_list_launches_requires_auth(client: TestClient) -> None:
    r = client.get(LAUNCHES_URL + "/")
    assert r.status_code == 401


def test_list_launches_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.get(LAUNCHES_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert data["count"] >= 1
    launch_ids = [launch["id"] for launch in data["data"]]
    assert str(test_launch.id) in launch_ids


def test_create_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: Location,
) -> None:
    launch_time = datetime.now(timezone.utc) + timedelta(days=60)
    payload = {
        "name": "New Launch",
        "location_id": str(test_location.id),
        "launch_timestamp": launch_time.isoformat(),
        "summary": "Test summary",
    }
    r = client.post(
        LAUNCHES_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "New Launch"
    assert data["summary"] == "Test summary"


def test_create_launch_location_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    launch_time = datetime.now(timezone.utc) + timedelta(days=60)
    payload = {
        "name": "New Launch",
        "location_id": str(uuid.uuid4()),
        "launch_timestamp": launch_time.isoformat(),
        "summary": "Test",
    }
    r = client.post(
        LAUNCHES_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 404


def test_get_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.get(
        f"{LAUNCHES_URL}/{test_launch.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_launch.id)


def test_get_launch_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{LAUNCHES_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_duplicate_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.post(
        f"{LAUNCHES_URL}/{test_launch.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"] != str(test_launch.id)
    assert "(copy)" in (data.get("name") or "")


def test_update_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.put(
        f"{LAUNCHES_URL}/{test_launch.id}",
        headers=superuser_token_headers,
        json={"summary": "Updated summary"},
    )
    assert r.status_code == 200
    assert r.json()["summary"] == "Updated summary"


def _create_booking_on_boat(
    db: Session,
    *,
    trip: Trip,
    boat: Boat,
    email: str,
    launch_updates_pref: bool = True,
) -> Booking:
    booking = Booking(
        confirmation_code=f"TEST{uuid.uuid4().hex[:8].upper()}",
        first_name="Test",
        last_name="Passenger",
        user_email=email,
        user_phone="+1234567890",
        billing_address="123 Test St",
        subtotal=5000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=5000,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
        launch_updates_pref=launch_updates_pref,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    item = BookingItem(
        booking_id=booking.id,
        trip_id=trip.id,
        boat_id=boat.id,
        item_type="adult",
        quantity=1,
        price_per_unit=5000,
        status=BookingItemStatus.active,
    )
    db.add(item)
    db.commit()
    return booking


@patch("app.api.routes.launches.send_email")
def test_send_launch_update_filters_by_boat_ids(
    mock_send_email,
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_launch: Launch,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_boat: Boat,
    test_provider: Provider,
) -> None:
    other_boat = Boat(
        name="Other Vessel",
        slug="other-vessel",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(other_boat)
    db.commit()
    db.refresh(other_boat)
    db.add(
        TripBoat(
            trip_id=test_trip.id,
            boat_id=other_boat.id,
            max_capacity=None,
            use_only_trip_pricing=False,
        )
    )
    db.commit()

    booking_a = _create_booking_on_boat(
        db, trip=test_trip, boat=test_boat, email="boat-a@example.com"
    )
    booking_b = _create_booking_on_boat(
        db, trip=test_trip, boat=other_boat, email="boat-b@example.com"
    )

    r = client.post(
        f"{LAUNCHES_URL}/{test_launch.id}/send-update",
        headers=superuser_token_headers,
        params={
            "trip_id": str(test_trip.id),
            "boat_ids": [str(test_boat.id)],
        },
        json={"message": "Boat-specific update", "priority": True},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["emails_sent"] == 1
    assert booking_a.user_email in data["recipients"]
    assert booking_b.user_email not in data["recipients"]
    mock_send_email.assert_called_once()


def test_send_launch_update_boat_ids_requires_trip_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
    test_boat: Boat,
) -> None:
    r = client.post(
        f"{LAUNCHES_URL}/{test_launch.id}/send-update",
        headers=superuser_token_headers,
        params={"boat_ids": [str(test_boat.id)]},
        json={"message": "Update", "priority": True},
    )
    assert r.status_code == 400
