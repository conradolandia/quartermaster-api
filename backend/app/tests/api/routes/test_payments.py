"""Tests for payments webhook and verification endpoints."""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import stripe
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Booking,
    BookingStatus,
    PaymentStatus,
)


def _create_draft_booking(
    db: Session,
    payment_intent_id: str = "pi_test",
) -> Booking:
    booking = Booking(
        confirmation_code=f"PAY{uuid.uuid4().hex[:8].upper()}",
        first_name="Jane",
        last_name="Doe",
        user_email="jane@example.com",
        user_phone="+1234567890",
        billing_address="456 Pay St, Test City, FL 32000",
        subtotal=5000,
        discount_amount=0,
        tax_amount=350,
        tip_amount=0,
        total_amount=5350,
        payment_status=PaymentStatus.pending_payment,
        booking_status=BookingStatus.draft,
        payment_intent_id=payment_intent_id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def _create_confirmed_booking(
    db: Session,
    payment_intent_id: str = "pi_test",
) -> Booking:
    booking = Booking(
        confirmation_code=f"CNF{uuid.uuid4().hex[:8].upper()}",
        first_name="John",
        last_name="Smith",
        user_email="john@example.com",
        user_phone="+1234567890",
        billing_address="789 Confirm Ave, Test City, FL 32000",
        subtotal=5000,
        discount_amount=0,
        tax_amount=350,
        tip_amount=0,
        total_amount=5350,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
        payment_intent_id=payment_intent_id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


# -- POST /payments/webhook --------------------------------------------------


@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("stripe.Webhook.construct_event")
def test_webhook_payment_succeeded(
    mock_construct: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_draft_booking(db, payment_intent_id="pi_test")

    mock_construct.return_value = SimpleNamespace(
        type="payment_intent.succeeded",
        data=SimpleNamespace(
            object=SimpleNamespace(id="pi_test", status="succeeded"),
        ),
    )

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "test_sig"},
        )

    assert r.status_code == 200
    assert r.json()["status"] == "success"


@patch("stripe.Webhook.construct_event")
def test_webhook_invalid_signature(
    mock_construct: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    mock_construct.side_effect = stripe.error.SignatureVerificationError(
        "bad sig", "sig_header"
    )

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "bad_sig"},
        )

    assert r.status_code == 400


# -- POST /payments/verify-payment/{id} --------------------------------------


@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_success(
    mock_retrieve: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_confirmed_booking(db, payment_intent_id="pi_test")

    mock_retrieve.return_value = SimpleNamespace(status="succeeded")

    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_test",
    )

    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "succeeded"
    assert data["booking_status"] == "confirmed"
