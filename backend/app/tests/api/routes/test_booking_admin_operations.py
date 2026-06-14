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
    BookingItemStatus,
    Merchandise,
    Mission,
    Trip,
    TripBoat,
    TripBoatPricing,
    TripMerchandise,
)

BOOKINGS_URL = f"{settings.API_V1_STR}/bookings"


def _create_target_trip(
    db: Session,
    *,
    mission_id: uuid.UUID,
    boat_id: uuid.UUID,
    name: str = "Other Trip",
) -> Trip:
    departure = datetime.now(timezone.utc) + timedelta(days=31, hours=-2)
    trip = Trip(
        mission_id=mission_id,
        name=name,
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    tb = TripBoat(trip_id=trip.id, boat_id=boat_id, max_capacity=50)
    db.add(tb)
    db.commit()
    db.refresh(tb)
    db.add(
        TripBoatPricing(
            trip_boat_id=tb.id,
            ticket_type="child",
            price=3000,
            capacity=20,
        ),
    )
    db.add(
        TripBoatPricing(
            trip_boat_id=tb.id,
            ticket_type="adult",
            price=6000,
            capacity=30,
        ),
    )
    db.commit()
    return trip


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
    trip2 = _create_target_trip(db, mission_id=test_mission.id, boat_id=test_boat.id)

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
    booking = data["booking"]
    items = booking.get("items", [])
    ticket_items = [i for i in items if i.get("trip_merchandise_id") is None]
    assert len(ticket_items) == 1
    assert ticket_items[0]["item_type"] == "child"
    assert ticket_items[0]["trip_id"] == str(trip2.id)
    assert data.get("merchandise_auto_attached") == []


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


def test_reschedule_moves_merch_when_target_has_same_merchandise(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_boat: Boat,
    test_mission: Mission,
    test_merchandise: Merchandise,
) -> None:
    source_tm = TripMerchandise(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
        price_override=2500,
        quantity_available_override=10,
    )
    db.add(source_tm)
    db.commit()
    db.refresh(source_tm)

    merch_item = BookingItem(
        booking_id=test_booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        trip_merchandise_id=source_tm.id,
        item_type=test_merchandise.name,
        quantity=1,
        price_per_unit=2500,
        status=BookingItemStatus.active,
    )
    db.add(merch_item)
    db.commit()
    db.refresh(merch_item)

    trip2 = _create_target_trip(db, mission_id=test_mission.id, boat_id=test_boat.id)
    target_tm = TripMerchandise(
        trip_id=trip2.id,
        merchandise_id=test_merchandise.id,
    )
    db.add(target_tm)
    db.commit()
    db.refresh(target_tm)

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(trip2.id)},
    )
    assert r.status_code == 200
    data = r.json()
    merch_items = [
        i for i in data["booking"]["items"] if i.get("trip_merchandise_id") is not None
    ]
    assert len(merch_items) == 1
    assert merch_items[0]["trip_id"] == str(trip2.id)
    assert merch_items[0]["boat_id"] == str(test_boat.id)
    assert merch_items[0]["trip_merchandise_id"] == str(target_tm.id)
    assert merch_items[0]["price_per_unit"] == 2500
    assert data["merchandise_auto_attached"] == []


def test_reschedule_auto_attaches_merch_with_overrides(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_boat: Boat,
    test_mission: Mission,
    test_merchandise: Merchandise,
) -> None:
    source_tm = TripMerchandise(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
        price_override=2500,
        quantity_available_override=10,
    )
    db.add(source_tm)
    db.commit()
    db.refresh(source_tm)

    merch_item = BookingItem(
        booking_id=test_booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        trip_merchandise_id=source_tm.id,
        item_type=test_merchandise.name,
        quantity=2,
        price_per_unit=2500,
        status=BookingItemStatus.active,
    )
    db.add(merch_item)
    db.commit()
    db.refresh(merch_item)

    trip2 = _create_target_trip(
        db, mission_id=test_mission.id, boat_id=test_boat.id, name="Merch Target"
    )

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(trip2.id)},
    )
    assert r.status_code == 200
    data = r.json()
    auto_attached = data["merchandise_auto_attached"]
    assert len(auto_attached) == 1
    assert auto_attached[0]["name"] == test_merchandise.name
    assert auto_attached[0]["merchandise_id"] == str(test_merchandise.id)

    merch_items = [
        i for i in data["booking"]["items"] if i.get("trip_merchandise_id") is not None
    ]
    assert len(merch_items) == 1
    assert merch_items[0]["trip_id"] == str(trip2.id)
    assert (
        merch_items[0]["trip_merchandise_id"] == auto_attached[0]["trip_merchandise_id"]
    )

    created_tm = db.get(
        TripMerchandise, uuid.UUID(auto_attached[0]["trip_merchandise_id"])
    )
    assert created_tm is not None
    assert created_tm.trip_id == trip2.id
    assert created_tm.merchandise_id == test_merchandise.id
    assert created_tm.price_override == 2500
    assert created_tm.quantity_available_override == 10


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
