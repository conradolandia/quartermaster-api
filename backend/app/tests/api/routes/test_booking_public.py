"""Tests for public booking endpoints (booking_public.py)."""

import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingItem,
    BookingStatus,
    Trip,
    TripBoat,
)

BOOKINGS_URL = f"{settings.API_V1_STR}/bookings"


def _make_booking_payload(
    *,
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    price_per_unit: int = 5000,
    quantity: int = 1,
    confirmation_code: str | None = None,
) -> dict:
    """Build a minimal valid BookingCreate dict."""
    code = confirmation_code or uuid.uuid4().hex[:8].upper()
    return {
        "confirmation_code": code,
        "first_name": "Jane",
        "last_name": "Doe",
        "user_email": "jane@example.com",
        "user_phone": "+1234567890",
        "billing_address": "123 Test St, FL 32000",
        "subtotal": price_per_unit * quantity,
        "discount_amount": 0,
        "tax_amount": 0,
        "tip_amount": 0,
        "total_amount": price_per_unit * quantity,
        "items": [
            {
                "trip_id": str(trip_id),
                "boat_id": str(boat_id),
                "item_type": "adult",
                "quantity": quantity,
                "price_per_unit": price_per_unit,
                "status": "active",
            }
        ],
    }


# ---------------------------------------------------------------------------
# 1. POST /bookings/ (create_booking)
# ---------------------------------------------------------------------------


def test_create_booking_success(
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
        price_per_unit=test_boat_pricing.price,
    )
    r = client.post(BOOKINGS_URL + "/", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["confirmation_code"] == payload["confirmation_code"]
    assert data["first_name"] == "Jane"
    assert data["booking_status"] == "draft"
    assert len(data["items"]) == 1
    assert data["items"][0]["item_type"] == "adult"


def test_create_booking_no_items(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    payload = _make_booking_payload(trip_id=test_trip.id, boat_id=test_boat.id)
    payload["items"] = []
    r = client.post(BOOKINGS_URL + "/", json=payload)
    assert r.status_code == 400
    assert "at least one item" in r.json()["detail"].lower()


def test_create_booking_inactive_trip(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    test_trip.active = False
    db.add(test_trip)
    db.commit()

    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=test_boat_pricing.price,
    )
    r = client.post(BOOKINGS_URL + "/", json=payload)
    assert r.status_code == 400
    assert "not active" in r.json()["detail"].lower()


def test_create_booking_capacity_exceeded(
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
        price_per_unit=test_boat_pricing.price,
        quantity=test_boat_pricing.capacity + 1,
    )
    payload["subtotal"] = test_boat_pricing.price * (test_boat_pricing.capacity + 1)
    payload["total_amount"] = payload["subtotal"]
    r = client.post(BOOKINGS_URL + "/", json=payload)
    assert r.status_code == 400
    assert "exceed capacity" in r.json()["detail"].lower()


def test_create_booking_price_mismatch(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    wrong_price = test_boat_pricing.price + 100
    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=wrong_price,
    )
    r = client.post(BOOKINGS_URL + "/", json=payload)
    assert r.status_code == 400
    assert "price mismatch" in r.json()["detail"].lower()


def test_create_booking_private_trip_no_auth(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    test_trip.booking_mode = "private"
    db.add(test_trip)
    db.commit()

    payload = _make_booking_payload(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        price_per_unit=test_boat_pricing.price,
    )
    r = client.post(BOOKINGS_URL + "/", json=payload)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# 2. GET /bookings/qr/{code}
# ---------------------------------------------------------------------------


def test_get_qr_code_success(
    client: TestClient,
    db: Session,
    test_booking: Booking,
) -> None:
    r = client.get(f"{BOOKINGS_URL}/qr/{test_booking.confirmation_code}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert len(r.content) > 0


def test_get_qr_code_not_found(
    client: TestClient,
    db: Session,
) -> None:
    r = client.get(f"{BOOKINGS_URL}/qr/NONEXISTENT")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# 3. PATCH /bookings/{code} (update draft)
# ---------------------------------------------------------------------------


def _create_draft_booking(db: Session) -> Booking:
    """Insert a draft booking directly in the DB."""
    booking = Booking(
        confirmation_code=uuid.uuid4().hex[:8].upper(),
        first_name="Draft",
        last_name="User",
        user_email="draft@example.com",
        user_phone="+1000000000",
        billing_address="456 Draft St",
        subtotal=5000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=5000,
        booking_status=BookingStatus.draft,
        payment_status=None,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def test_update_draft_booking(
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db)
    r = client.patch(
        f"{BOOKINGS_URL}/{booking.confirmation_code}",
        json={"first_name": "Updated"},
    )
    assert r.status_code == 200
    assert r.json()["first_name"] == "Updated"


def test_update_non_draft_booking(
    client: TestClient,
    db: Session,
    test_booking: Booking,
) -> None:
    """test_booking fixture is confirmed; updates should be rejected."""
    r = client.patch(
        f"{BOOKINGS_URL}/{test_booking.confirmation_code}",
        json={"first_name": "Nope"},
    )
    assert r.status_code == 400
    assert "cannot update" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. GET /bookings/{code}
# ---------------------------------------------------------------------------


def test_get_booking_by_code(
    client: TestClient,
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    r = client.get(f"{BOOKINGS_URL}/{test_booking.confirmation_code}")
    assert r.status_code == 200
    data = r.json()
    assert data["confirmation_code"] == test_booking.confirmation_code
    assert data["first_name"] == test_booking.first_name


def test_get_booking_not_found(
    client: TestClient,
    db: Session,
) -> None:
    r = client.get(f"{BOOKINGS_URL}/NOTACODE")
    assert r.status_code == 404


def test_get_booking_strips_admin_notes(
    client: TestClient,
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    test_booking.admin_notes = "Secret internal note"
    db.add(test_booking)
    db.commit()

    r = client.get(f"{BOOKINGS_URL}/{test_booking.confirmation_code}")
    assert r.status_code == 200
    assert r.json()["admin_notes"] is None


# ---------------------------------------------------------------------------
# 5. POST /bookings/{code}/resend-email
# ---------------------------------------------------------------------------


def test_resend_email_draft_booking(
    client: TestClient,
    db: Session,
) -> None:
    booking = _create_draft_booking(db)
    r = client.post(f"{BOOKINGS_URL}/{booking.confirmation_code}/resend-email")
    assert r.status_code == 400
    assert "confirmed" in r.json()["detail"].lower()


@patch("app.api.routes.booking_public.send_email")
@patch("app.api.routes.booking_public.generate_booking_confirmation_email")
@patch("app.api.routes.booking_public.settings")
def test_resend_email_confirmed_booking(
    mock_settings,
    mock_generate_email,
    mock_send_email,
    client: TestClient,
    db: Session,
    test_booking: Booking,
    test_booking_item: BookingItem,
) -> None:
    mock_settings.emails_enabled = True
    mock_generate_email.return_value.subject = "Booking Confirmed"
    mock_generate_email.return_value.html_content = "<p>Confirmed</p>"

    r = client.post(f"{BOOKINGS_URL}/{test_booking.confirmation_code}/resend-email")

    assert r.status_code == 200
    assert r.json()["status"] == "success"
    mock_send_email.assert_called_once()
