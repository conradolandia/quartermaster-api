"""Unit tests for payment confirmation email helpers."""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from sqlmodel import Session

from app.api.routes.payments import (
    send_booking_confirmation_email,
    send_booking_confirmation_email_task,
)
from app.models import (
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    PaymentStatus,
)


def _booking_with_item(
    db: Session,
    *,
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    confirmation_email_sent_at: datetime | None = None,
) -> Booking:
    booking = Booking(
        confirmation_code=f"EML{uuid.uuid4().hex[:6].upper()}",
        first_name="Email",
        last_name="Tester",
        user_email="email@example.com",
        user_phone="+1234567890",
        billing_address="123 Email St",
        subtotal=5000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=5000,
        booking_status=BookingStatus.confirmed,
        payment_status=PaymentStatus.paid,
        confirmation_email_sent_at=confirmation_email_sent_at,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    item = BookingItem(
        booking_id=booking.id,
        trip_id=trip_id,
        boat_id=boat_id,
        item_type="adult",
        quantity=1,
        price_per_unit=5000,
        status=BookingItemStatus.active,
    )
    db.add(item)
    db.commit()
    db.refresh(booking)
    booking.items = [item]
    return booking


@patch("app.api.routes.payments.settings")
@patch("app.api.routes.payments.send_email")
@patch("app.api.routes.payments.generate_booking_confirmation_email")
@patch("app.api.routes.payments.build_experience_display_dict")
def test_send_booking_confirmation_email_success(
    mock_experience: MagicMock,
    mock_generate: MagicMock,
    mock_send: MagicMock,
    mock_settings: MagicMock,
    db: Session,
    test_trip,
    test_boat,
) -> None:
    mock_settings.emails_enabled = True
    mock_experience.return_value = {}
    mock_generate.return_value = SimpleNamespace(
        subject="Confirmed",
        html_content="<p>ok</p>",
    )
    booking = _booking_with_item(db, trip_id=test_trip.id, boat_id=test_boat.id)

    send_booking_confirmation_email(db, booking)

    mock_send.assert_called_once()
    db.refresh(booking)
    assert booking.confirmation_email_sent_at is not None


@patch("app.api.routes.payments.settings")
def test_send_booking_confirmation_email_skips_if_already_sent(
    mock_settings: MagicMock,
    db: Session,
    test_trip,
    test_boat,
) -> None:
    mock_settings.emails_enabled = True
    sent_at = datetime.now(timezone.utc)
    booking = _booking_with_item(
        db,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        confirmation_email_sent_at=sent_at,
    )

    with patch("app.api.routes.payments.send_email") as mock_send:
        send_booking_confirmation_email(db, booking)
        mock_send.assert_not_called()


@patch("app.api.routes.payments.settings")
def test_send_booking_confirmation_email_skips_when_disabled(
    mock_settings: MagicMock,
    db: Session,
    test_trip,
    test_boat,
) -> None:
    mock_settings.emails_enabled = False
    booking = _booking_with_item(db, trip_id=test_trip.id, boat_id=test_boat.id)

    with patch("app.api.routes.payments.send_email") as mock_send:
        send_booking_confirmation_email(db, booking)
        mock_send.assert_not_called()


@patch("app.api.routes.payments.settings")
def test_send_booking_confirmation_email_skips_no_items(
    mock_settings: MagicMock,
    db: Session,
) -> None:
    mock_settings.emails_enabled = True
    booking = Booking(
        confirmation_code=f"NOI{uuid.uuid4().hex[:6].upper()}",
        first_name="No",
        last_name="Items",
        user_email="noitems@example.com",
        user_phone="+1234567890",
        billing_address="123 St",
        subtotal=0,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=0,
        booking_status=BookingStatus.confirmed,
        payment_status=PaymentStatus.paid,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    booking.items = []

    with patch("app.api.routes.payments.send_email") as mock_send:
        send_booking_confirmation_email(db, booking)
        mock_send.assert_not_called()


@patch("app.api.routes.payments.settings")
def test_send_booking_confirmation_email_skips_missing_trip(
    mock_settings: MagicMock,
    db: Session,
) -> None:
    mock_settings.emails_enabled = True
    missing_trip_id = uuid.uuid4()
    item = MagicMock()
    item.trip_id = missing_trip_id
    item.item_type = "adult"
    item.quantity = 1
    item.price_per_unit = 5000
    booking = MagicMock()
    booking.id = uuid.uuid4()
    booking.confirmation_code = "MISSING"
    booking.user_email = "miss@example.com"
    booking.first_name = "Miss"
    booking.last_name = "Trip"
    booking.total_amount = 5000
    booking.confirmation_email_sent_at = None
    booking.items = [item]

    with patch("app.api.routes.payments.send_email") as mock_send:
        send_booking_confirmation_email(db, booking)
        mock_send.assert_not_called()


@patch("app.api.routes.payments.settings")
@patch("app.api.routes.payments.send_email", side_effect=RuntimeError("smtp down"))
@patch("app.api.routes.payments.generate_booking_confirmation_email")
@patch("app.api.routes.payments.build_experience_display_dict", return_value={})
def test_send_booking_confirmation_email_logs_error_on_failure(
    _mock_experience: MagicMock,
    mock_generate: MagicMock,
    _mock_send: MagicMock,
    mock_settings: MagicMock,
    db: Session,
    test_trip,
    test_boat,
) -> None:
    mock_settings.emails_enabled = True
    mock_generate.return_value = SimpleNamespace(
        subject="Confirmed",
        html_content="<p>ok</p>",
    )
    booking = _booking_with_item(db, trip_id=test_trip.id, boat_id=test_boat.id)

    send_booking_confirmation_email(db, booking)

    db.refresh(booking)
    assert booking.confirmation_email_sent_at is None


@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("app.api.routes.payments.Session")
def test_send_booking_confirmation_email_task(
    mock_session_cls: MagicMock,
    mock_send: MagicMock,
    db: Session,
    test_trip,
    test_boat,
) -> None:
    mock_session_cls.return_value.__enter__.return_value = db
    booking = _booking_with_item(db, trip_id=test_trip.id, boat_id=test_boat.id)
    send_booking_confirmation_email_task(booking.id)
    mock_send.assert_called_once()


def test_send_booking_confirmation_email_task_missing_booking(db: Session) -> None:
    with patch("app.api.routes.payments.send_booking_confirmation_email") as mock_send:
        send_booking_confirmation_email_task(uuid.uuid4())
        mock_send.assert_not_called()
