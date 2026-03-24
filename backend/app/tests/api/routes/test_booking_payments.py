"""Tests for payment-related booking endpoints."""

import uuid
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingStatus,
    PaymentStatus,
    Trip,
    TripBoat,
)
from app.tests.api.routes.test_booking_public import BOOKINGS_URL, _make_booking_payload

API_PREFIX = f"{settings.API_V1_STR}/bookings"


def _create_draft_booking(db: Session, **overrides) -> Booking:
    defaults = {
        "confirmation_code": f"TEST{uuid.uuid4().hex[:8].upper()}",
        "first_name": "Jane",
        "last_name": "Doe",
        "user_email": "jane@example.com",
        "user_phone": "+1234567890",
        "billing_address": "456 Test Ave, Test City, FL 32000",
        "subtotal": 5000,
        "discount_amount": 0,
        "tax_amount": 350,
        "tip_amount": 0,
        "total_amount": 5350,
        "payment_status": None,
        "booking_status": BookingStatus.draft,
    }
    defaults.update(overrides)
    booking = Booking(**defaults)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def _mock_payment_intent(id: str = "pi_test", client_secret: str = "secret_test"):
    pi = MagicMock()
    pi.id = id
    pi.client_secret = client_secret
    return pi


# --- POST /bookings/checkout ---


@patch("app.api.routes.booking_public.retrieve_payment_intent")
@patch("app.core.stripe.create_payment_intent")
def test_checkout_paid_booking(
    mock_create: MagicMock,
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    mock_create.return_value = _mock_payment_intent()
    mock_retrieve.return_value = _mock_payment_intent()
    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=test_boat_pricing.price,
    )
    resp = client.post(f"{BOOKINGS_URL}/checkout", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["payment_intent_id"] == "pi_test"
    assert data["client_secret"] == "secret_test"
    assert data["status"] == "pending_payment"
    assert data["booking"]["confirmation_code"] == payload["confirmation_code"]
    assert data["booking"]["booking_status"] == "draft"
    assert data["booking"]["payment_status"] == "pending_payment"
    mock_create.assert_called_once()
    db_row = db.exec(
        select(Booking).where(Booking.confirmation_code == payload["confirmation_code"])
    ).first()
    assert db_row is not None
    assert db_row.payment_intent_id == "pi_test"


@patch("app.api.routes.booking_public.retrieve_payment_intent")
@patch("app.core.stripe.create_payment_intent")
def test_checkout_sub_minimum_uses_confirm_free_not_checkout(
    mock_create: MagicMock,
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=10,
        quantity=1,
    )
    payload["subtotal"] = 10
    payload["total_amount"] = 10
    resp = client.post(f"{BOOKINGS_URL}/checkout", json=payload)
    assert resp.status_code == 400
    assert "confirm-free-booking" in resp.json()["detail"].lower()
    mock_create.assert_not_called()
    mock_retrieve.assert_not_called()


@patch("app.core.stripe.create_payment_intent")
def test_checkout_capacity_exceeded_no_booking_row(
    mock_create: MagicMock,
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    mock_create.return_value = _mock_payment_intent()
    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=test_boat_pricing.price,
        quantity=test_boat_pricing.capacity + 1,
    )
    payload["subtotal"] = test_boat_pricing.price * (test_boat_pricing.capacity + 1)
    payload["total_amount"] = payload["subtotal"]
    code = payload["confirmation_code"]
    resp = client.post(f"{BOOKINGS_URL}/checkout", json=payload)
    assert resp.status_code == 400
    assert "exceed" in resp.json()["detail"].lower()
    assert (
        db.exec(select(Booking).where(Booking.confirmation_code == code)).first()
        is None
    )


@patch("app.core.stripe.create_payment_intent")
def test_checkout_stripe_error_no_booking_row(
    mock_create: MagicMock,
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    mock_create.side_effect = HTTPException(
        status_code=400,
        detail="Error creating payment intent: card declined",
    )
    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=test_boat_pricing.price,
    )
    code = payload["confirmation_code"]
    resp = client.post(f"{BOOKINGS_URL}/checkout", json=payload)
    assert resp.status_code == 400
    assert (
        db.exec(select(Booking).where(Booking.confirmation_code == code)).first()
        is None
    )


# --- GET /bookings/{code}/resume-payment ---


@patch("app.api.routes.booking_payments.retrieve_payment_intent")
def test_resume_payment_success(
    mock_retrieve: MagicMock, client: TestClient, db: Session
) -> None:
    booking = _create_draft_booking(
        db,
        payment_intent_id="pi_resume",
        payment_status=PaymentStatus.pending_payment,
    )
    mock_retrieve.return_value = _mock_payment_intent(
        id="pi_resume", client_secret="secret_resume"
    )

    resp = client.get(f"{API_PREFIX}/{booking.confirmation_code}/resume-payment")
    assert resp.status_code == 200

    data = resp.json()
    assert data["payment_intent_id"] == "pi_resume"
    assert data["client_secret"] == "secret_resume"
    assert data["status"] == "pending_payment"
    mock_retrieve.assert_called_once_with("pi_resume")


@patch("app.api.routes.booking_payments.retrieve_payment_intent")
def test_resume_payment_after_failed_payment(
    mock_retrieve: MagicMock, client: TestClient, db: Session
) -> None:
    booking = _create_draft_booking(
        db,
        payment_intent_id="pi_after_fail",
        payment_status=PaymentStatus.failed,
    )
    mock_retrieve.return_value = _mock_payment_intent(
        id="pi_after_fail", client_secret="secret_after_fail"
    )

    resp = client.get(f"{API_PREFIX}/{booking.confirmation_code}/resume-payment")
    assert resp.status_code == 200
    data = resp.json()
    assert data["payment_intent_id"] == "pi_after_fail"
    assert data["client_secret"] == "secret_after_fail"


@patch("app.api.routes.booking_payments.retrieve_payment_intent")
def test_resume_payment_no_intent(
    mock_retrieve: MagicMock, client: TestClient, db: Session
) -> None:
    booking = _create_draft_booking(db, payment_status=PaymentStatus.pending_payment)

    resp = client.get(f"{API_PREFIX}/{booking.confirmation_code}/resume-payment")
    assert resp.status_code == 400
    assert "no payment intent" in resp.json()["detail"].lower()
    mock_retrieve.assert_not_called()


# --- POST /bookings/{code}/confirm-free-booking ---


@patch("app.api.routes.payments.send_booking_confirmation_email")
def test_confirm_free_booking_success(
    mock_email: MagicMock, client: TestClient, db: Session
) -> None:
    booking = _create_draft_booking(db, total_amount=0)

    resp = client.post(f"{API_PREFIX}/{booking.confirmation_code}/confirm-free-booking")
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"

    db.refresh(booking)
    assert booking.booking_status == BookingStatus.confirmed
    assert booking.payment_status == PaymentStatus.free
    mock_email.assert_called_once()


@patch("app.api.routes.payments.send_booking_confirmation_email")
def test_confirm_free_booking_non_zero(
    mock_email: MagicMock, client: TestClient, db: Session
) -> None:
    booking = _create_draft_booking(db, total_amount=5000)

    resp = client.post(f"{API_PREFIX}/{booking.confirmation_code}/confirm-free-booking")
    assert resp.status_code == 400
    assert "sub-minimum" in resp.json()["detail"].lower()
    mock_email.assert_not_called()


@patch("app.api.routes.payments.send_booking_confirmation_email")
def test_confirm_free_booking_not_draft(
    mock_email: MagicMock, client: TestClient, db: Session
) -> None:
    booking = _create_draft_booking(
        db, total_amount=0, booking_status=BookingStatus.confirmed
    )

    resp = client.post(f"{API_PREFIX}/{booking.confirmation_code}/confirm-free-booking")
    assert resp.status_code == 400
    assert "status" in resp.json()["detail"].lower()
    mock_email.assert_not_called()
