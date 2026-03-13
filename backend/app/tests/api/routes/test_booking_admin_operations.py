"""Tests for admin booking operations (booking_admin_operations.py)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingItem,
    Mission,
    Trip,
    TripBoat,
    TripBoatPricing,
)

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


def test_reschedule_with_type_mapping_updates_item_type(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_boat: Boat,
    test_mission: Mission,
) -> None:
    """Reschedule with type_mapping; items get mapped type."""
    departure = datetime.now(timezone.utc) + timedelta(days=31, hours=-2)
    trip2 = Trip(
        mission_id=test_mission.id,
        name="Other Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(trip2)
    db.commit()
    db.refresh(trip2)
    tb2 = TripBoat(trip_id=trip2.id, boat_id=test_boat.id, max_capacity=50)
    db.add(tb2)
    db.commit()
    db.refresh(tb2)
    db.add(
        TripBoatPricing(
            trip_boat_id=tb2.id,
            ticket_type="child",
            price=3000,
            capacity=20,
        ),
    )
    db.add(
        TripBoatPricing(
            trip_boat_id=tb2.id,
            ticket_type="adult",
            price=6000,
            capacity=30,
        ),
    )
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={
            "target_trip_id": str(trip2.id),
            "type_mapping": {"adult": "child"},
        },
    )
    assert r.status_code == 200
    data = r.json()
    items = data.get("items", [])
    ticket_items = [i for i in items if i.get("trip_merchandise_id") is None]
    assert len(ticket_items) == 1
    assert ticket_items[0]["item_type"] == "child"
    assert ticket_items[0]["trip_id"] == str(trip2.id)


def test_reschedule_with_invalid_type_mapping_target_returns_400(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_trip_boat_pricing: TripBoatPricing,
) -> None:
    """Reschedule with type_mapping target type not on boat returns 400."""
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={
            "target_trip_id": str(test_trip.id),
            "type_mapping": {"adult": "nonexistent_type"},
        },
    )
    assert r.status_code == 400
    assert "not available" in r.json().get("detail", "").lower()


def test_reschedule_with_unmapped_ticket_type_returns_400(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_trip_boat_pricing: TripBoatPricing,
) -> None:
    """Reschedule with type_mapping missing a booking ticket type returns 400."""
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={
            "target_trip_id": str(test_trip.id),
            "type_mapping": {"other_type": "adult"},
        },
    )
    assert r.status_code == 400
    assert "unmapped" in r.json().get("detail", "").lower()


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
