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
    DiscountCode,
    PaymentStatus,
)


def _create_draft_booking(
    db: Session,
    payment_intent_id: str = "pi_test",
    discount_code_id: uuid.UUID | None = None,
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
        discount_code_id=discount_code_id,
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


@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_confirms_and_increments_discount_used_count(
    mock_retrieve: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
    test_discount_code: DiscountCode,
) -> None:
    _create_draft_booking(
        db,
        payment_intent_id="pi_dc_use",
        discount_code_id=test_discount_code.id,
    )
    assert test_discount_code.used_count == 0

    mock_retrieve.return_value = SimpleNamespace(status="succeeded")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_dc_use",
    )
    assert r.status_code == 200
    db.refresh(test_discount_code)
    assert test_discount_code.used_count == 1


# -- POST /payments/create-payment-intent -------------------------------------


@patch("app.api.routes.payments.create_payment_intent")
def test_create_payment_intent_endpoint(
    mock_create: MagicMock,
    client: TestClient,
) -> None:
    mock_create.return_value = SimpleNamespace(
        id="pi_new",
        client_secret="secret_new",
    )
    r = client.post(
        f"{settings.API_V1_STR}/payments/create-payment-intent",
        params={"amount": 5000},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["payment_intent_id"] == "pi_new"
    assert data["client_secret"] == "secret_new"
    mock_create.assert_called_once_with(5000, "usd")


# -- POST /payments/verify-payment/{id} (more cases) --------------------------


def test_verify_payment_404_no_booking(
    client: TestClient,
    db: Session,
) -> None:
    with patch("app.api.routes.payments.retrieve_payment_intent") as mock_retrieve:
        mock_retrieve.return_value = SimpleNamespace(status="succeeded")
        r = client.post(
            f"{settings.API_V1_STR}/payments/verify-payment/pi_nonexistent",
        )
    assert r.status_code == 404
    assert "No booking" in r.json().get("detail", "")


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_requires_payment_method(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_draft_booking(db, payment_intent_id="pi_req_method")
    mock_retrieve.return_value = SimpleNamespace(status="requires_payment_method")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_req_method",
    )
    assert r.status_code == 200
    assert r.json()["status"] == "requires_payment_method"


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_canceled_updates_booking(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_draft_booking(db, payment_intent_id="pi_canceled")
    mock_retrieve.return_value = SimpleNamespace(status="canceled")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_canceled",
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "canceled"
    assert data["booking_status"] == "draft"


# -- POST /payments/webhook (more cases) --------------------------------------


def test_webhook_500_no_secret(
    client: TestClient,
) -> None:
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", None):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "x"},
        )
    assert r.status_code == 500
    assert "configured" in r.json().get("detail", "").lower()


@patch("stripe.Webhook.construct_event")
def test_webhook_400_invalid_payload(
    mock_construct: MagicMock,
    client: TestClient,
) -> None:
    mock_construct.side_effect = ValueError("Invalid payload")
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"not json",
            headers={"stripe-signature": "x"},
        )
    assert r.status_code == 400
    assert "payload" in r.json().get("detail", "").lower()


@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("stripe.Webhook.construct_event")
def test_webhook_payment_failed(
    mock_construct: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db, payment_intent_id="pi_failed")
    mock_construct.return_value = SimpleNamespace(
        type="payment_intent.payment_failed",
        data=SimpleNamespace(
            object=SimpleNamespace(id="pi_failed"),
        ),
    )
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "sig"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "success"
    db.refresh(booking)
    assert booking.booking_status == BookingStatus.draft
    assert booking.payment_status == PaymentStatus.failed


@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_already_confirmed(
    mock_retrieve: MagicMock,
    mock_send_email: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_confirmed_booking(db, payment_intent_id="pi_already_confirmed")
    mock_retrieve.return_value = SimpleNamespace(status="succeeded")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_already_confirmed",
    )
    assert r.status_code == 200
    assert r.json()["booking_status"] == "confirmed"
    mock_send_email.assert_not_called()


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_cancelled_capacity_conflict(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db, payment_intent_id="pi_cap_fail")
    booking.booking_status = BookingStatus.cancelled
    booking.payment_status = PaymentStatus.failed
    db.add(booking)
    db.commit()
    mock_retrieve.return_value = SimpleNamespace(status="succeeded")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_cap_fail",
    )
    assert r.status_code == 409


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_other_statuses(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_draft_booking(db, payment_intent_id="pi_processing")
    for status_name in (
        "requires_confirmation",
        "requires_action",
        "processing",
        "requires_capture",
    ):
        mock_retrieve.return_value = SimpleNamespace(status=status_name)
        r = client.post(
            f"{settings.API_V1_STR}/payments/verify-payment/pi_processing",
        )
        assert r.status_code == 200
        assert r.json()["status"] == status_name


@patch("stripe.Webhook.construct_event")
def test_webhook_succeeded_already_confirmed(
    mock_construct: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_confirmed_booking(db, payment_intent_id="pi_wh_confirmed")
    mock_construct.return_value = SimpleNamespace(
        type="payment_intent.succeeded",
        data=SimpleNamespace(object=SimpleNamespace(id="pi_wh_confirmed")),
    )
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "sig"},
        )
    assert r.status_code == 200


@patch("stripe.Webhook.construct_event")
def test_webhook_succeeded_no_booking(
    mock_construct: MagicMock,
    client: TestClient,
) -> None:
    mock_construct.return_value = SimpleNamespace(
        type="payment_intent.succeeded",
        data=SimpleNamespace(object=SimpleNamespace(id="pi_orphan")),
    )
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "sig"},
        )
    assert r.status_code == 200


@patch("stripe.Webhook.construct_event")
def test_webhook_payment_failed_already_applied(
    mock_construct: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db, payment_intent_id="pi_already_failed")
    booking.payment_status = PaymentStatus.failed
    db.add(booking)
    db.commit()
    mock_construct.return_value = SimpleNamespace(
        type="payment_intent.payment_failed",
        data=SimpleNamespace(object=SimpleNamespace(id="pi_already_failed")),
    )
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "sig"},
        )
    assert r.status_code == 200


@patch("stripe.Webhook.construct_event")
def test_webhook_payment_failed_skips_non_draft(
    mock_construct: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_confirmed_booking(db, payment_intent_id="pi_confirmed_fail")
    mock_construct.return_value = SimpleNamespace(
        type="payment_intent.payment_failed",
        data=SimpleNamespace(object=SimpleNamespace(id="pi_confirmed_fail")),
    )
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "sig"},
        )
    assert r.status_code == 200


@patch("app.api.routes.payments.create_payment_intent")
def test_create_payment_intent_endpoint_again_with_same_idempotency_key(
    mock_create: MagicMock,
    client: TestClient,
) -> None:
    mock_create.return_value = SimpleNamespace(
        client_secret="cs_test",
        id="pi_new",
    )
    r = client.post(
        f"{settings.API_V1_STR}/payments/create-payment-intent",
        params={"amount": 5000, "currency": "usd"},
    )
    assert r.status_code == 200
    assert r.json()["client_secret"] == "cs_test"
    assert r.json()["payment_intent_id"] == "pi_new"


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_canceled_draft_booking(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db, payment_intent_id="pi_canceled_draft")
    mock_retrieve.return_value = SimpleNamespace(status="canceled")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_canceled_draft",
    )
    assert r.status_code == 200
    assert r.json()["booking_status"] == "draft"
    db.refresh(booking)
    assert booking.payment_status == PaymentStatus.failed


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_canceled_confirmed_booking(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_confirmed_booking(db, payment_intent_id="pi_canceled_conf")
    mock_retrieve.return_value = SimpleNamespace(status="canceled")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_canceled_conf",
    )
    assert r.status_code == 200
    assert r.json()["booking_status"] == "cancelled"
    db.refresh(booking)
    assert booking.booking_status == BookingStatus.cancelled


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_canceled_already_cancelled(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db, payment_intent_id="pi_already_cancel")
    booking.booking_status = BookingStatus.cancelled
    booking.payment_status = PaymentStatus.failed
    db.add(booking)
    db.commit()
    mock_retrieve.return_value = SimpleNamespace(status="canceled")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_already_cancel",
    )
    assert r.status_code == 200
    assert r.json()["booking_status"] == "cancelled"


@patch("app.api.routes.payments.retrieve_payment_intent")
def test_verify_payment_unknown_status(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
) -> None:
    _create_draft_booking(db, payment_intent_id="pi_unknown")
    mock_retrieve.return_value = SimpleNamespace(status="requires_source")
    r = client.post(
        f"{settings.API_V1_STR}/payments/verify-payment/pi_unknown",
    )
    assert r.status_code == 200
    assert r.json()["status"] == "requires_source"


def test_webhook_missing_secret(client: TestClient) -> None:
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", ""):
        r = client.post(
            f"{settings.API_V1_STR}/payments/webhook",
            content=b"{}",
            headers={"stripe-signature": "sig"},
        )
    assert r.status_code == 500
