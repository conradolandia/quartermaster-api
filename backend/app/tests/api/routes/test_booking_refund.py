"""Tests for booking refund endpoint."""

import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    Mission,
    PaymentStatus,
    Trip,
)

REFUND_URL = f"{settings.API_V1_STR}/bookings/refund"


def _create_confirmed_booking_for_refund(
    db: Session,
    *,
    confirmation_code: str = "REFUND01",
    mission: Mission,
    trip: Trip,
    boat_id: uuid.UUID,
    total_amount: int = 10000,
    payment_intent_id: str | None = "pi_refund_test",
) -> Booking:
    booking = Booking(
        confirmation_code=confirmation_code,
        first_name="Refund",
        last_name="User",
        user_email="refund@example.com",
        user_phone="+1234567890",
        billing_address="123 Refund St",
        subtotal=total_amount,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=total_amount,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
        payment_intent_id=payment_intent_id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    item = BookingItem(
        booking_id=booking.id,
        trip_id=trip.id,
        boat_id=boat_id,
        item_type="adult",
        quantity=1,
        price_per_unit=total_amount,
        status=BookingItemStatus.active,
    )
    db.add(item)
    db.commit()
    return booking


def test_refund_404_unknown_confirmation_code(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{REFUND_URL}/UNKNOWN99",
        headers=superuser_token_headers,
        json={"refund_reason": "Customer request", "refund_notes": None},
    )
    assert r.status_code == 404
    assert "not found" in r.json().get("detail", "").lower()


def test_refund_400_invalid_confirmation_code_format(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{REFUND_URL}/ab",
        headers=superuser_token_headers,
        json={"refund_reason": "Customer request", "refund_notes": None},
    )
    assert r.status_code == 400
    assert "invalid" in r.json().get("detail", "").lower()


def test_refund_400_booking_not_refundable_status(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
    test_boat,
) -> None:
    booking = _create_confirmed_booking_for_refund(
        db,
        confirmation_code="NREFUND1",
        mission=test_mission,
        trip=test_trip,
        boat_id=test_boat.id,
        payment_intent_id=None,
    )
    booking.booking_status = BookingStatus.cancelled
    db.add(booking)
    db.commit()

    r = client.post(
        f"{REFUND_URL}/{booking.confirmation_code}",
        headers=superuser_token_headers,
        json={"refund_reason": "Customer request", "refund_notes": None},
    )
    assert r.status_code == 400
    assert (
        "status" in r.json().get("detail", "").lower()
        or "cannot refund" in r.json().get("detail", "").lower()
    )


def test_refund_400_amount_exceeds_remaining(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
    test_boat,
) -> None:
    booking = _create_confirmed_booking_for_refund(
        db,
        confirmation_code="EXCEED01",
        mission=test_mission,
        trip=test_trip,
        boat_id=test_boat.id,
        total_amount=5000,
        payment_intent_id=None,
    )

    r = client.post(
        f"{REFUND_URL}/{booking.confirmation_code}",
        headers=superuser_token_headers,
        json={
            "refund_reason": "Partial",
            "refund_notes": None,
            "refund_amount_cents": 10000,
        },
    )
    assert r.status_code == 400
    assert (
        "exceed" in r.json().get("detail", "").lower()
        or "refundable" in r.json().get("detail", "").lower()
    )


@patch("app.services.refund.send_email")
@patch("app.core.stripe.refund_payment", new_callable=MagicMock)
def test_refund_success_full_refund_with_stripe(
    mock_refund_payment: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
    test_boat,
) -> None:
    mock_refund_payment.return_value = MagicMock(id="re_123")

    booking = _create_confirmed_booking_for_refund(
        db,
        confirmation_code="FULLREF1",
        mission=test_mission,
        trip=test_trip,
        boat_id=test_boat.id,
        total_amount=7500,
        payment_intent_id="pi_full",
    )

    r = client.post(
        f"{REFUND_URL}/{booking.confirmation_code}",
        headers=superuser_token_headers,
        json={"refund_reason": "Customer request", "refund_notes": "Duplicate booking"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["confirmation_code"] == booking.confirmation_code
    assert data["booking_status"] == "cancelled"
    mock_refund_payment.assert_called_once_with("pi_full", 7500)
    mock_send_email.assert_called_once()


@patch("app.services.refund.send_email")
def test_refund_success_without_stripe_no_payment_intent(
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
    test_boat,
) -> None:
    booking = _create_confirmed_booking_for_refund(
        db,
        confirmation_code="NOPI01",
        mission=test_mission,
        trip=test_trip,
        boat_id=test_boat.id,
        total_amount=5000,
        payment_intent_id=None,
    )

    r = client.post(
        f"{REFUND_URL}/{booking.confirmation_code}",
        headers=superuser_token_headers,
        json={"refund_reason": "No payment", "refund_notes": None},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["booking_status"] == "cancelled"
    mock_send_email.assert_called_once()


def _create_multi_item_booking_for_refund(
    db: Session,
    *,
    confirmation_code: str,
    mission: Mission,
    trip: Trip,
    boat_id: uuid.UUID,
    payment_intent_id: str | None = "pi_multi",
) -> tuple[Booking, BookingItem, BookingItem]:
    subtotal = 10000
    discount = 1000
    tax = 540  # 6% on 9000
    total = subtotal - discount + tax
    booking = Booking(
        confirmation_code=confirmation_code,
        first_name="Multi",
        last_name="Refund",
        user_email="multi@example.com",
        user_phone="+1234567890",
        billing_address="123 Refund St",
        subtotal=subtotal,
        discount_amount=discount,
        tax_amount=tax,
        tip_amount=0,
        total_amount=total,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
        payment_intent_id=payment_intent_id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    adult = BookingItem(
        booking_id=booking.id,
        trip_id=trip.id,
        boat_id=boat_id,
        item_type="adult",
        quantity=1,
        price_per_unit=6000,
        status=BookingItemStatus.active,
    )
    child = BookingItem(
        booking_id=booking.id,
        trip_id=trip.id,
        boat_id=boat_id,
        item_type="child",
        quantity=1,
        price_per_unit=4000,
        status=BookingItemStatus.active,
    )
    db.add(adult)
    db.add(child)
    db.commit()
    db.refresh(adult)
    db.refresh(child)
    return booking, adult, child


@patch("app.services.refund.send_email")
@patch("app.core.stripe.refund_payment", new_callable=MagicMock)
def test_refund_success_line_items_partial(
    mock_refund_payment: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
    test_boat,
) -> None:
    mock_refund_payment.return_value = MagicMock(id="re_item")

    booking, adult, child = _create_multi_item_booking_for_refund(
        db,
        confirmation_code="ITEMREF1",
        mission=test_mission,
        trip=test_trip,
        boat_id=test_boat.id,
    )

    from app.services.refund import compute_line_item_refund_cents

    expected_child_refund = compute_line_item_refund_cents(child, booking)

    r = client.post(
        f"{REFUND_URL}/{booking.confirmation_code}",
        headers=superuser_token_headers,
        json={
            "refund_reason": "Child cannot attend",
            "refund_notes": "One ticket only",
            "refund_item_ids": [str(child.id)],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["booking_status"] == "confirmed"
    assert data["payment_status"] == "partially_refunded"
    assert data["refunded_amount_cents"] == expected_child_refund
    mock_refund_payment.assert_called_once_with("pi_multi", expected_child_refund)

    items_by_type = {item["item_type"]: item for item in data["items"]}
    assert items_by_type["child"]["status"] == "refunded"
    assert items_by_type["child"]["refunded_amount_cents"] == expected_child_refund
    assert items_by_type["child"]["refund_reason"] == "Child cannot attend"
    assert items_by_type["adult"]["status"] == "active"
    assert items_by_type["adult"]["refunded_amount_cents"] == 0


@patch("app.services.refund.send_email")
@patch("app.core.stripe.refund_payment", new_callable=MagicMock)
def test_refund_success_line_items_all_cancels_booking(
    mock_refund_payment: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
    test_boat,
) -> None:
    mock_refund_payment.return_value = MagicMock(id="re_all")

    booking, adult, child = _create_multi_item_booking_for_refund(
        db,
        confirmation_code="ITEMREF2",
        mission=test_mission,
        trip=test_trip,
        boat_id=test_boat.id,
    )

    r = client.post(
        f"{REFUND_URL}/{booking.confirmation_code}",
        headers=superuser_token_headers,
        json={
            "refund_reason": "Full cancel",
            "refund_item_ids": [str(adult.id), str(child.id)],
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["booking_status"] == "cancelled"
    assert data["payment_status"] == "refunded"
    assert data["refunded_amount_cents"] == booking.total_amount
    assert all(item["status"] == "refunded" for item in data["items"])
