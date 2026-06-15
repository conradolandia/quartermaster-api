"""Tests for trip bulk refund endpoints."""

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
    PaymentStatus,
    Trip,
)

TRIPS_URL = f"{settings.API_V1_STR}/trips"


def _create_booking_on_trip(
    db: Session,
    *,
    confirmation_code: str,
    trip: Trip,
    boat_id: uuid.UUID,
    total_amount: int = 10000,
    booking_status: BookingStatus = BookingStatus.confirmed,
    payment_status: PaymentStatus = PaymentStatus.paid,
    payment_intent_id: str | None = "pi_test",
    refunded_amount_cents: int = 0,
) -> Booking:
    booking = Booking(
        confirmation_code=confirmation_code,
        first_name="Bulk",
        last_name="Refund",
        user_email="bulk@example.com",
        user_phone="+1234567890",
        billing_address="123 Bulk St",
        subtotal=total_amount,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=total_amount,
        refunded_amount_cents=refunded_amount_cents,
        payment_status=payment_status,
        booking_status=booking_status,
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


def test_refundable_bookings_404_unknown_trip(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{TRIPS_URL}/{uuid.uuid4()}/refundable-bookings",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_refundable_bookings_filters_eligible_only(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat,
) -> None:
    eligible = _create_booking_on_trip(
        db,
        confirmation_code="ELIG001",
        trip=test_trip,
        boat_id=test_boat.id,
        total_amount=5000,
        payment_intent_id="pi_eligible",
    )
    _create_booking_on_trip(
        db,
        confirmation_code="CHKIN01",
        trip=test_trip,
        boat_id=test_boat.id,
        booking_status=BookingStatus.checked_in,
    )
    _create_booking_on_trip(
        db,
        confirmation_code="PART001",
        trip=test_trip,
        boat_id=test_boat.id,
        payment_status=PaymentStatus.partially_refunded,
        refunded_amount_cents=1000,
    )
    _create_booking_on_trip(
        db,
        confirmation_code="NOPI001",
        trip=test_trip,
        boat_id=test_boat.id,
        payment_intent_id=None,
    )

    r = client.get(
        f"{TRIPS_URL}/{test_trip.id}/refundable-bookings",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1
    assert data["total_refundable_cents"] == eligible.total_amount
    assert data["bookings"][0]["confirmation_code"] == "ELIG001"
    assert data["bookings"][0]["refund_amount_cents"] == eligible.total_amount
    assert data["skipped_count"] == 3
    skip_codes = {s["confirmation_code"] for s in data["skipped"]}
    assert skip_codes == {"CHKIN01", "PART001", "NOPI001"}
    skip_reasons = {s["skip_reason"] for s in data["skipped"]}
    assert skip_reasons == {"checked_in", "partially_refunded", "no_stripe"}
    assert data["committed_passengers"] >= 1


@patch("app.services.refund.send_email")
@patch("app.core.stripe.refund_payment", new_callable=MagicMock)
def test_refund_paid_bookings_success_and_continue_on_failure(
    mock_refund_payment: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat,
) -> None:
    mock_refund_payment.side_effect = [
        MagicMock(id="re_ok"),
        Exception("Stripe declined"),
    ]

    _create_booking_on_trip(
        db,
        confirmation_code="BULK001",
        trip=test_trip,
        boat_id=test_boat.id,
        total_amount=4000,
        payment_intent_id="pi_ok",
    )
    _create_booking_on_trip(
        db,
        confirmation_code="BULK002",
        trip=test_trip,
        boat_id=test_boat.id,
        total_amount=6000,
        payment_intent_id="pi_fail",
    )

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/refund-paid-bookings",
        headers=superuser_token_headers,
        json={
            "refund_reason": "Weather conditions",
            "refund_notes": "Trip cancelled",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["refunded_count"] == 1
    assert data["failed_count"] == 1
    assert data["total_refunded_cents"] == 4000
    assert len(data["failures"]) == 1
    assert data["failures"][0]["confirmation_code"] == "BULK002"
    assert "stripe" in data["failures"][0]["detail"].lower()
    assert mock_refund_payment.call_count == 2
    assert mock_send_email.call_count == 1


def test_refund_paid_bookings_requires_reason(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/refund-paid-bookings",
        headers=superuser_token_headers,
        json={"refund_reason": "   ", "refund_notes": None},
    )
    assert r.status_code == 400
