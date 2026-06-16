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
    BookingStatus,
    Merchandise,
    Mission,
    Provider,
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


def test_reschedule_allows_target_boat_with_sales_disabled(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_boat: Boat,
    test_mission: Mission,
) -> None:
    """Admin reschedule succeeds when target trip boat has sales paused."""
    trip2 = _create_target_trip(db, mission_id=test_mission.id, boat_id=test_boat.id)
    target_tb = db.exec(
        __import__("sqlmodel", fromlist=["select"])
        .select(TripBoat)
        .where(TripBoat.trip_id == trip2.id, TripBoat.boat_id == test_boat.id)
    ).first()
    assert target_tb is not None
    target_tb.sales_enabled = False
    db.add(target_tb)
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(trip2.id)},
    )
    assert r.status_code == 200
    booking = r.json()["booking"]
    items = booking.get("items", [])
    ticket_items = [i for i in items if i.get("trip_merchandise_id") is None]
    assert len(ticket_items) == 1
    assert ticket_items[0]["trip_id"] == str(trip2.id)


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


def test_reschedule_checked_in_booking_rejected(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
) -> None:
    test_booking.booking_status = BookingStatus.checked_in
    db.add(test_booking)
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(test_trip.id)},
    )
    assert r.status_code == 400
    assert "checked-in" in r.json()["detail"]


def test_reschedule_no_ticket_items(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip: Trip,
) -> None:
    booking = Booking(
        confirmation_code=f"NOTKT{uuid.uuid4().hex[:6].upper()}",
        first_name="No",
        last_name="Tickets",
        user_email="notkt@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=0,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=0,
        booking_status=BookingStatus.confirmed,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    r = client.post(
        f"{BOOKINGS_URL}/id/{booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(test_trip.id)},
    )
    assert r.status_code == 400
    assert "no ticket items" in r.json()["detail"].lower()


def test_reschedule_archived_trip_rejected(
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

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(test_trip.id)},
    )
    assert r.status_code == 400
    assert "archived trip" in r.json()["detail"].lower()


def test_reschedule_target_trip_no_boats(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_mission: Mission,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=40)
    empty_trip = Trip(
        mission_id=test_mission.id,
        name="No Boats Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(empty_trip)
    db.commit()
    db.refresh(empty_trip)

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(empty_trip.id)},
    )
    assert r.status_code == 400
    assert "no boats" in r.json()["detail"].lower()


def test_reschedule_multi_boat_requires_boat_id(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_boat: Boat,
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    trip2 = _create_target_trip(db, mission_id=test_mission.id, boat_id=test_boat.id)
    second_boat = Boat(
        name="Second Boat",
        slug="second-boat",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(second_boat)
    db.commit()
    db.refresh(second_boat)
    db.add(TripBoat(trip_id=trip2.id, boat_id=second_boat.id))
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(trip2.id)},
    )
    assert r.status_code == 400
    assert "boat_id is required" in r.json()["detail"]


def test_reschedule_invalid_boat_id(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_provider: Provider,
) -> None:
    second_boat = Boat(
        name="Linked Boat",
        slug="linked-boat",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(second_boat)
    db.commit()
    db.refresh(second_boat)
    db.add(TripBoat(trip_id=test_trip.id, boat_id=second_boat.id))
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={
            "target_trip_id": str(test_trip.id),
            "boat_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 400
    assert "not associated" in r.json()["detail"]


def test_reschedule_capacity_exceeded(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_mission: Mission,
    test_boat: Boat,
) -> None:
    trip2 = _create_target_trip(db, mission_id=test_mission.id, boat_id=test_boat.id)
    tb = db.exec(
        __import__("sqlmodel", fromlist=["select"])
        .select(TripBoat)
        .where(TripBoat.trip_id == trip2.id, TripBoat.boat_id == test_boat.id)
    ).first()
    assert tb is not None
    tb.max_capacity = 1
    db.add(tb)
    for pricing in db.exec(
        __import__("sqlmodel", fromlist=["select"])
        .select(TripBoatPricing)
        .where(TripBoatPricing.trip_boat_id == tb.id)
    ).all():
        pricing.capacity = 1
        db.add(pricing)
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/id/{test_booking.id}/reschedule",
        headers=superuser_token_headers,
        json={"target_trip_id": str(trip2.id)},
    )
    assert r.status_code == 400
    assert "capacity" in r.json()["detail"].lower()


def test_check_in_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/check-in/{test_booking.confirmation_code}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["booking_status"] == "checked_in"


def test_check_in_invalid_status(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
) -> None:
    test_booking.booking_status = BookingStatus.draft
    db.add(test_booking)
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/check-in/{test_booking.confirmation_code}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400


def test_check_in_wrong_trip_boat_context(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/check-in/{test_booking.confirmation_code}",
        headers=superuser_token_headers,
        params={
            "trip_id": str(uuid.uuid4()),
            "boat_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 400


def test_revert_check_in_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.booking_status = BookingStatus.checked_in
    test_booking_item.status = BookingItemStatus.fulfilled
    db.add(test_booking)
    db.add(test_booking_item)
    db.commit()

    r = client.post(
        f"{BOOKINGS_URL}/revert-check-in/{test_booking.confirmation_code}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["booking_status"] == "confirmed"


def test_revert_check_in_not_checked_in(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
) -> None:
    r = client.post(
        f"{BOOKINGS_URL}/revert-check-in/{test_booking.confirmation_code}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
