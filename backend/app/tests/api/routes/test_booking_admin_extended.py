"""Additional booking_admin list/update coverage tests."""

import uuid
from unittest.mock import patch

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


def test_list_bookings_limit_capped_at_500(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"limit": 1000},
    )
    assert r.status_code == 200
    assert r.json()["per_page"] == 500


def test_list_bookings_sort_by_created_at_asc(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(
        BOOKINGS_URL + "/",
        headers=superuser_token_headers,
        params={"sort_by": "created_at", "sort_direction": "asc"},
    )
    assert r.status_code == 200
    assert "data" in r.json()


def test_update_booking_invalid_allowed_field_value(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"total_amount": 99999},
    )
    assert r.status_code == 200
    assert r.json()["total_amount"] == 99999


def test_update_booking_transition_to_checked_in(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"booking_status": "checked_in"},
    )
    assert r.status_code == 200
    db.refresh(test_booking)
    assert test_booking.booking_status == BookingStatus.checked_in


@patch("app.api.routes.booking_admin.send_email")
@patch("app.api.routes.booking_admin.generate_booking_cancelled_email")
@patch("app.api.routes.booking_admin.settings")
def test_update_booking_cancel_sends_cancellation_email(
    mock_settings,
    mock_generate_email,
    mock_send_email,
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.payment_status = PaymentStatus.failed
    db.add(test_booking)
    db.commit()

    mock_settings.emails_enabled = True
    mock_generate_email.return_value.subject = "Cancelled"
    mock_generate_email.return_value.html_content = "<p>cancelled</p>"

    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"booking_status": "cancelled"},
    )
    assert r.status_code == 200
    mock_send_email.assert_called_once()


@patch("app.api.routes.booking_admin.send_email")
@patch("app.api.routes.booking_admin.generate_booking_refunded_email")
@patch("app.api.routes.booking_admin.settings")
def test_update_booking_cancel_with_refund_sends_refund_email(
    mock_settings,
    mock_generate_email,
    mock_send_email,
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.payment_status = PaymentStatus.refunded
    test_booking.refund_reason = "Customer request"
    db.add(test_booking)
    db.commit()

    mock_settings.emails_enabled = True
    mock_generate_email.return_value.subject = "Refunded"
    mock_generate_email.return_value.html_content = "<p>refunded</p>"

    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"booking_status": "cancelled"},
    )
    assert r.status_code == 200
    mock_send_email.assert_called_once()


def test_update_booking_discount_code_id_not_allowed(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.patch(
        f"{BOOKINGS_URL}/id/{test_booking.id}",
        headers=superuser_token_headers,
        json={"discount_code_id": str(uuid.uuid4())},
    )
    assert r.status_code == 400
    assert "not allowed" in r.json()["detail"].lower()


def test_update_booking_merchandise_quantity_increase(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip: Trip,
    test_boat,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    merch = Merchandise(
        name="Qty Merch",
        description="x",
        price=1000,
        quantity_available=10,
    )
    db.add(merch)
    db.commit()
    db.refresh(merch)
    variation = MerchandiseVariation(
        merchandise_id=merch.id,
        variant_value="",
        quantity_total=10,
        quantity_sold=1,
        quantity_fulfilled=0,
    )
    db.add(variation)
    db.commit()
    db.refresh(variation)
    trip_merch = crud_tm.create_trip_merchandise(
        session=db,
        trip_merchandise_in=TripMerchandiseCreate(
            trip_id=test_trip.id,
            merchandise_id=merch.id,
        ),
    )
    db.commit()
    db.refresh(trip_merch)

    booking = Booking(
        confirmation_code=f"QTY{uuid.uuid4().hex[:6].upper()}",
        first_name="Qty",
        last_name="Test",
        user_email="qty@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=2000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=2000,
        booking_status=BookingStatus.confirmed,
        payment_status=PaymentStatus.paid,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    item = BookingItem(
        booking_id=booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        trip_merchandise_id=trip_merch.id,
        item_type="merch",
        quantity=1,
        price_per_unit=1000,
        status=BookingItemStatus.active,
        merchandise_variation_id=variation.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    r = client.patch(
        f"{BOOKINGS_URL}/id/{booking.id}",
        headers=superuser_token_headers,
        json={"item_quantity_updates": [{"id": str(item.id), "quantity": 3}]},
    )
    assert r.status_code == 200
    db.refresh(variation)
    assert variation.quantity_sold == 3


def test_update_booking_merchandise_insufficient_inventory(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip: Trip,
    test_boat,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    merch = Merchandise(
        name="Low Stock",
        description="x",
        price=1000,
        quantity_available=2,
    )
    db.add(merch)
    db.commit()
    db.refresh(merch)
    variation = MerchandiseVariation(
        merchandise_id=merch.id,
        variant_value="",
        quantity_total=2,
        quantity_sold=1,
        quantity_fulfilled=0,
    )
    db.add(variation)
    db.commit()
    db.refresh(variation)
    trip_merch = crud_tm.create_trip_merchandise(
        session=db,
        trip_merchandise_in=TripMerchandiseCreate(
            trip_id=test_trip.id,
            merchandise_id=merch.id,
        ),
    )
    db.commit()
    db.refresh(trip_merch)

    booking = Booking(
        confirmation_code=f"LOW{uuid.uuid4().hex[:6].upper()}",
        first_name="Low",
        last_name="Stock",
        user_email="low@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=1000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=1000,
        booking_status=BookingStatus.confirmed,
        payment_status=PaymentStatus.paid,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    item = BookingItem(
        booking_id=booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        trip_merchandise_id=trip_merch.id,
        item_type="merch",
        quantity=1,
        price_per_unit=1000,
        status=BookingItemStatus.active,
        merchandise_variation_id=variation.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    r = client.patch(
        f"{BOOKINGS_URL}/id/{booking.id}",
        headers=superuser_token_headers,
        json={"item_quantity_updates": [{"id": str(item.id), "quantity": 5}]},
    )
    assert r.status_code == 400
    assert "insufficient" in r.json()["detail"].lower()
