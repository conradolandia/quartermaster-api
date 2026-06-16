"""Additional booking_admin list/update coverage tests."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    Merchandise,
    MerchandiseVariation,
    PaymentStatus,
    Trip,
    TripBoat,
)

BOOKINGS_URL = f"{settings.API_V1_STR}/bookings"


def test_list_bookings_sort_by_trip_type(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_mission,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={
            "mission_id": str(test_mission.id),
            "sort_by": "trip_type",
            "sort_direction": "desc",
        },
    )
    assert r.status_code == 200
    assert "total_pages" in r.json()


def test_list_bookings_generates_missing_qr_codes(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.qr_code_base64 = None
    db.add(test_booking)
    db.commit()

    r = client.get(BOOKINGS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    db.refresh(test_booking)
    assert test_booking.qr_code_base64 is not None


def test_update_booking_item_quantity_invalid_item(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={
            "item_quantity_updates": [
                {"id": str(uuid.uuid4()), "quantity": 1},
            ],
        },
    )
    assert r.status_code == 400
    assert "not found or does not belong" in r.json()["detail"]


def test_update_booking_item_quantity_exceeds_capacity(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip_boat: TripBoat,
    test_boat_pricing,
    test_trip_boat_pricing,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={
            "item_quantity_updates": [
                {"id": str(test_booking_item.id), "quantity": 999},
            ],
        },
    )
    assert r.status_code == 400
    assert "capacity" in r.json()["detail"].lower()


def test_update_booking_item_quantity_zero_removes_item(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
    test_trip_boat: TripBoat,
    test_boat_pricing,
    test_trip_boat_pricing,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={
            "item_quantity_updates": [
                {"id": str(test_booking_item.id), "quantity": 0},
            ],
        },
    )
    assert r.status_code == 200
    assert db.get(BookingItem, test_booking_item.id) is None


def test_update_booking_cancel_with_refunded_payment(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.payment_status = PaymentStatus.refunded
    db.add(test_booking)
    db.commit()

    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"booking_status": "cancelled"},
    )
    assert r.status_code == 200
    db.refresh(test_booking_item)
    assert test_booking_item.status == BookingItemStatus.refunded


def test_delete_booking_restores_merchandise_inventory(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip: Trip,
    test_boat,
) -> None:
    merch = Merchandise(
        name="Delete Restore Merch",
        description="x",
        price=1000,
        quantity_available=5,
    )
    db.add(merch)
    db.commit()
    db.refresh(merch)
    variation = MerchandiseVariation(
        merchandise_id=merch.id,
        variant_value="",
        quantity_total=10,
        quantity_sold=2,
        quantity_fulfilled=1,
    )
    db.add(variation)
    db.commit()
    db.refresh(variation)

    booking = Booking(
        confirmation_code=f"MRCH{uuid.uuid4().hex[:6].upper()}",
        first_name="Merch",
        last_name="Delete",
        user_email="merch@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=2000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=2000,
        booking_status=BookingStatus.draft,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    item = BookingItem(
        booking_id=booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        item_type="merch",
        quantity=2,
        price_per_unit=1000,
        status=BookingItemStatus.fulfilled,
        merchandise_variation_id=variation.id,
    )
    db.add(item)
    db.commit()

    r = client.delete(
        f"{BOOKINGS_URL}/id/{booking.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204
    db.refresh(variation)
    assert variation.quantity_sold == 0
    assert variation.quantity_fulfilled == 0
