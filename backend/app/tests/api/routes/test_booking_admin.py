"""Tests for admin booking endpoints (booking_admin.py)."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    BoatPricing,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    Mission,
    Trip,
    TripBoat,
)

BOOKINGS_URL = f"{settings.API_V1_STR}/bookings"


# --- Auth: require superuser ---


def test_list_bookings_requires_superuser(client: TestClient) -> None:
    r = client.get(BOOKINGS_URL + "/")
    assert r.status_code == 401


def test_list_bookings_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(BOOKINGS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "total" in data
    assert data["total"] >= 1
    assert any(b["id"] == str(test_booking.id) for b in data["data"])


def test_list_bookings_filter_confirmation_code(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"search": test_booking.confirmation_code[:8]},
    )
    assert r.status_code == 200
    data = r.json()
    assert any(
        b["confirmation_code"] == test_booking.confirmation_code for b in data["data"]
    )


def test_list_bookings_filter_mission_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_mission: Mission,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    data = r.json()
    assert "data" in data


def test_list_bookings_search_multi_word(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    """Multi-word search ANDs terms: each word must match in at least one searchable field."""
    # test_booking has first_name="John", last_name="Doe" -> "John Doe" should find it
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"search": "John Doe"},
    )
    assert r.status_code == 200
    data = r.json()
    assert any(b["id"] == str(test_booking.id) for b in data["data"])

    # First name + part of email: both terms match
    r2 = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"search": "John example.com"},
    )
    assert r2.status_code == 200
    data2 = r2.json()
    assert any(b["id"] == str(test_booking.id) for b in data2["data"])

    # Second term does not match any field -> booking not in results (AND behavior)
    r3 = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"search": "John NonexistentWord"},
    )
    assert r3.status_code == 200
    data3 = r3.json()
    assert not any(b["id"] == str(test_booking.id) for b in data3["data"])


def test_get_booking_by_id_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == str(test_booking.id)
    assert data["confirmation_code"] == test_booking.confirmation_code
    assert len(data["items"]) >= 1


def test_get_booking_by_id_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{BOOKINGS_URL}/id/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_duplicate_booking_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    # test_trip_boat links trip/boat; test_boat_pricing provides effective price for "adult"
    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"] != str(test_booking.id)
    assert data["confirmation_code"] != test_booking.confirmation_code
    assert data["booking_status"] == "draft"
    assert len(data["items"]) >= 1
    # New booking exists in db
    created = db.get(Booking, uuid.UUID(data["id"]))
    assert created is not None


def test_duplicate_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/id/{uuid.uuid4()}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_booking_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    # test_booking is confirmed, not checked_in; we can update admin_notes
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"admin_notes": "Admin note from test"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["admin_notes"] == "Admin note from test"


def test_update_booking_empty_body(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={},
    )
    assert r.status_code == 400


def test_update_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"admin_notes": "x"},
    )
    assert r.status_code == 404


def test_delete_booking_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip: Trip,
    test_trip_boat: TripBoat,
) -> None:
    # Create a booking and item to delete (so we don't rely on test_booking for other tests)
    booking = Booking(
        confirmation_code=f"DEL{uuid.uuid4().hex[:8].upper()}",
        first_name="Delete",
        last_name="Me",
        user_email="del@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=5000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=5000,
        booking_status=BookingStatus.draft,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    item = BookingItem(
        booking_id=booking.id,
        trip_id=test_trip_boat.trip_id,
        boat_id=test_trip_boat.boat_id,
        item_type="adult",
        quantity=1,
        price_per_unit=5000,
        status=BookingItemStatus.active,
    )
    db.add(item)
    db.commit()

    r = client.delete(
        f"{BOOKINGS_URL}/id/{booking.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204

    got = db.get(Booking, booking.id)
    assert got is None


def test_delete_booking_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.delete(
        f"{BOOKINGS_URL}/id/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
