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
    Launch,
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


def test_list_bookings_filter_ticket_item_type(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"ticket_item_type": "adult"},
    )
    assert r.status_code == 200
    data = r.json()
    assert any(b["id"] == str(test_booking.id) for b in data["data"])

    r2 = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"ticket_item_type": "nonexistent_ticket_type_xyz"},
    )
    assert r2.status_code == 200
    data2 = r2.json()
    assert not any(b["id"] == str(test_booking.id) for b in data2["data"])


def test_list_booking_ticket_item_types(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        f"{BOOKINGS_URL}/ticket-item-types",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "adult" in data["data"]


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


def test_duplicate_booking_no_items(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    booking = Booking(
        confirmation_code=f"EMPTY{uuid.uuid4().hex[:6].upper()}",
        first_name="Empty",
        last_name="Booking",
        user_email="empty@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=0,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=0,
        booking_status=BookingStatus.draft,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    r = client.post(
        f"{BOOKINGS_URL}/id/{booking.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
    assert "no items" in r.json()["detail"]


def test_list_bookings_negative_skip(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"skip": -1},
    )
    assert r.status_code == 400


def test_list_bookings_invalid_limit(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"limit": 0},
    )
    assert r.status_code == 400


def test_list_bookings_filter_launch_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_launch: Launch,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"launch_id": str(test_launch.id)},
    )
    assert r.status_code == 200
    assert any(b["id"] == str(test_booking.id) for b in r.json()["data"])


def test_list_bookings_filter_trip_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"trip_id": str(test_trip.id)},
    )
    assert r.status_code == 200
    assert any(b["id"] == str(test_booking.id) for b in r.json()["data"])


def test_list_bookings_filter_boat_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip_boat: TripBoat,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"boat_id": str(test_trip_boat.boat_id)},
    )
    assert r.status_code == 200
    assert any(b["id"] == str(test_booking.id) for b in r.json()["data"])


def test_list_bookings_filter_trip_type(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"trip_type": "launch_viewing"},
    )
    assert r.status_code == 200
    assert any(b["id"] == str(test_booking.id) for b in r.json()["data"])


def test_list_bookings_filter_statuses(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={
            "booking_status": ["confirmed"],
            "payment_status": ["paid"],
        },
    )
    assert r.status_code == 200
    assert any(b["id"] == str(test_booking.id) for b in r.json()["data"])


def test_list_bookings_sort_by_trip_name(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_mission: Mission,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={
            "mission_id": str(test_mission.id),
            "sort_by": "trip_name",
            "sort_direction": "asc",
        },
    )
    assert r.status_code == 200
    assert "data" in r.json()


def test_list_bookings_sort_by_boat_name(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={
            "trip_id": str(test_trip.id),
            "sort_by": "boat_name",
            "sort_direction": "desc",
        },
    )
    assert r.status_code == 200


def test_list_bookings_sort_by_total_quantity(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={
            "trip_id": str(test_trip.id),
            "sort_by": "total_quantity",
            "sort_direction": "asc",
        },
    )
    assert r.status_code == 200


def test_list_bookings_sort_by_ticket_item_type(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_mission: Mission,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={
            "mission_id": str(test_mission.id),
            "sort_by": "ticket_item_type",
            "sort_direction": "asc",
        },
    )
    assert r.status_code == 200


def test_list_bookings_include_archived(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
) -> None:
    test_trip.archived = True
    db.add(test_trip)
    db.commit()

    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"include_archived": "true"},
    )
    assert r.status_code == 200
    assert any(b["id"] == str(test_booking.id) for b in r.json()["data"])


def test_list_ticket_item_types_filter_by_trip(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking_item: BookingItem,
    test_trip: Trip,
) -> None:
    r = client.get(
        f"{BOOKINGS_URL}/ticket-item-types",
        headers=superuser_token_headers,
        params={"trip_id": str(test_trip.id)},
    )
    assert r.status_code == 200
    assert "adult" in r.json()["data"]


def test_get_booking_generates_qr_code(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.qr_code_base64 = None
    db.add(test_booking)
    db.commit()

    r = client.get(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    db.refresh(test_booking)
    assert test_booking.qr_code_base64 is not None


def test_update_booking_checked_in_rejected(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.booking_status = BookingStatus.checked_in
    db.add(test_booking)
    db.commit()

    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"admin_notes": "Should fail"},
    )
    assert r.status_code == 400
    assert "checked-in" in r.json()["detail"]


def test_update_booking_invalid_status_transition(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"booking_status": "completed"},
    )
    assert r.status_code == 400
    assert "Cannot transition" in r.json()["detail"]


def test_update_booking_negative_tip(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"tip_amount": -100},
    )
    assert r.status_code == 400
    assert "Tip amount cannot be negative" in r.json()["detail"]


def test_update_booking_cancel_status(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"booking_status": "cancelled"},
    )
    assert r.status_code == 200
    db.refresh(test_booking)
    db.refresh(test_booking_item)
    assert test_booking.booking_status == BookingStatus.cancelled
    assert test_booking_item.status == BookingItemStatus.cancelled


def test_update_booking_item_quantity(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={
            "item_quantity_updates": [
                {"id": str(test_booking_item.id), "quantity": 1},
            ],
        },
    )
    assert r.status_code == 200
    db.refresh(test_booking_item)
    assert test_booking_item.quantity == 1
