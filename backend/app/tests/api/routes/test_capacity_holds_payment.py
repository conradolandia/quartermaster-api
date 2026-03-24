"""Capacity holds on checkout and resume payment."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    Mission,
    PaymentStatus,
    Provider,
    Trip,
    TripBoat,
)

API_BOOKINGS = f"{settings.API_V1_STR}/bookings"


def _mock_payment_intent(
    id: str = "pi_test", client_secret: str = "secret_test"
) -> MagicMock:
    pi = MagicMock()
    pi.id = id
    pi.client_secret = client_secret
    return pi


def _trip_and_boat(
    db: Session, mission: Mission, provider: Provider, boat_capacity: int = 10
) -> tuple[Trip, Boat]:
    boat = Boat(
        name="Hold Boat",
        slug=f"hold-{uuid.uuid4().hex[:8]}",
        capacity=boat_capacity,
        provider_id=provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)
    db.add(
        BoatPricing(
            boat_id=boat.id,
            ticket_type="adult",
            price=1000,
            capacity=boat_capacity,
        )
    )
    departure = datetime.now(timezone.utc) + timedelta(days=30)
    trip = Trip(
        mission_id=mission.id,
        name="Hold Trip",
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
    db.add(TripBoat(trip_id=trip.id, boat_id=boat.id, max_capacity=None))
    db.commit()
    return trip, boat


def _checkout_payload(
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    qty: int,
    confirmation_code: str,
) -> dict:
    total = qty * 1000
    return {
        "confirmation_code": confirmation_code,
        "first_name": "X",
        "last_name": "Y",
        "user_email": f"{confirmation_code.lower()}@example.com",
        "user_phone": "+1",
        "billing_address": "z",
        "subtotal": total,
        "discount_amount": 0,
        "tax_amount": 0,
        "tip_amount": 0,
        "total_amount": total,
        "items": [
            {
                "trip_id": str(trip_id),
                "boat_id": str(boat_id),
                "item_type": "adult",
                "quantity": qty,
                "price_per_unit": 1000,
                "status": "active",
            }
        ],
    }


@patch("app.api.routes.booking_public.retrieve_payment_intent")
@patch("app.core.stripe.create_payment_intent")
def test_second_checkout_fails_when_first_booking_holds_seats(
    mock_pi: MagicMock,
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    trip, boat = _trip_and_boat(db, test_mission, test_provider)
    mock_retrieve.return_value = _mock_payment_intent()
    mock_pi.return_value = _mock_payment_intent("pi_first")
    p1 = _checkout_payload(trip.id, boat.id, 6, f"H1{uuid.uuid4().hex[:6].upper()}")
    assert client.post(f"{API_BOOKINGS}/checkout", json=p1).status_code == 201

    mock_pi.return_value = _mock_payment_intent("pi_second")
    p2 = _checkout_payload(trip.id, boat.id, 6, f"H2{uuid.uuid4().hex[:6].upper()}")
    assert client.post(f"{API_BOOKINGS}/checkout", json=p2).status_code == 400


@patch("app.api.routes.booking_public.retrieve_payment_intent")
@patch("app.core.stripe.create_payment_intent")
def test_checkout_succeeds_after_first_hold_expires(
    mock_pi: MagicMock,
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    trip, boat = _trip_and_boat(db, test_mission, test_provider)
    code1 = f"E1{uuid.uuid4().hex[:6].upper()}"
    code2 = f"E2{uuid.uuid4().hex[:6].upper()}"
    p1 = _checkout_payload(trip.id, boat.id, 6, code1)
    mock_pi.return_value = _mock_payment_intent("pi_a")
    mock_retrieve.return_value = _mock_payment_intent("pi_a")
    assert client.post(f"{API_BOOKINGS}/checkout", json=p1).status_code == 201

    p2 = _checkout_payload(trip.id, boat.id, 6, code2)
    mock_pi.return_value = _mock_payment_intent("pi_b")
    mock_retrieve.return_value = _mock_payment_intent("pi_b")
    assert client.post(f"{API_BOOKINGS}/checkout", json=p2).status_code == 400

    b1 = db.exec(select(Booking).where(Booking.confirmation_code == code1)).first()
    assert b1 is not None
    b1.capacity_hold_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.add(b1)
    db.commit()

    mock_pi.return_value = _mock_payment_intent("pi_b2")
    mock_retrieve.return_value = _mock_payment_intent("pi_b2")
    assert client.post(f"{API_BOOKINGS}/checkout", json=p2).status_code == 201


@patch("app.api.routes.booking_payments.retrieve_payment_intent")
def test_resume_payment_fails_when_paid_plus_requested_exceeds_boat(
    mock_retrieve: MagicMock,
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    trip, boat = _trip_and_boat(db, test_mission, test_provider)
    c = Booking(
        confirmation_code=f"C{uuid.uuid4().hex[:8].upper()}",
        first_name="P",
        last_name="aid",
        user_email="paid@example.com",
        user_phone="+1",
        billing_address="x",
        subtotal=5000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=5000,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    db.add(
        BookingItem(
            booking_id=c.id,
            trip_id=trip.id,
            boat_id=boat.id,
            item_type="adult",
            quantity=5,
            price_per_unit=1000,
            status=BookingItemStatus.active,
        )
    )
    db.commit()

    b = Booking(
        confirmation_code=f"R{uuid.uuid4().hex[:8].upper()}",
        first_name="R",
        last_name="esume",
        user_email="resume@example.com",
        user_phone="+1",
        billing_address="x",
        subtotal=6000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=6000,
        payment_status=PaymentStatus.pending_payment,
        booking_status=BookingStatus.draft,
        payment_intent_id="pi_resume_cap",
        capacity_hold_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    db.add(
        BookingItem(
            booking_id=b.id,
            trip_id=trip.id,
            boat_id=boat.id,
            item_type="adult",
            quantity=6,
            price_per_unit=1000,
            status=BookingItemStatus.active,
        )
    )
    db.commit()

    mock_retrieve.return_value = _mock_payment_intent("pi_resume_cap")
    r = client.get(f"{API_BOOKINGS}/{b.confirmation_code}/resume-payment")
    assert r.status_code == 400


@patch("app.api.routes.booking_payments.hold_expiry_utc")
@patch("app.api.routes.booking_payments.retrieve_payment_intent")
def test_resume_payment_refreshes_capacity_hold_expires_at(
    mock_retrieve: MagicMock,
    mock_hold_expiry: MagicMock,
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    trip, boat = _trip_and_boat(db, test_mission, test_provider)
    t1 = datetime(2030, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2030, 1, 1, 12, 5, 0, tzinfo=timezone.utc)
    # resume_payment calls hold_expiry_utc once; prior expiry on the row is t1
    mock_hold_expiry.return_value = t2

    b = Booking(
        confirmation_code=f"RF{uuid.uuid4().hex[:8].upper()}",
        first_name="A",
        last_name="B",
        user_email="rf@example.com",
        user_phone="+1",
        billing_address="x",
        subtotal=1000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=1000,
        payment_status=PaymentStatus.pending_payment,
        booking_status=BookingStatus.draft,
        payment_intent_id="pi_rf",
        capacity_hold_expires_at=t1,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    db.add(
        BookingItem(
            booking_id=b.id,
            trip_id=trip.id,
            boat_id=boat.id,
            item_type="adult",
            quantity=1,
            price_per_unit=1000,
            status=BookingItemStatus.active,
        )
    )
    db.commit()

    mock_retrieve.return_value = _mock_payment_intent("pi_rf")
    r = client.get(f"{API_BOOKINGS}/{b.confirmation_code}/resume-payment")
    assert r.status_code == 200
    db.refresh(b)
    assert b.capacity_hold_expires_at == t2
