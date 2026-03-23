"""Trip capacity vs paid+held counts; webhook confirms only when capacity allows."""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
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


def test_read_trip_capacity_used_matches_sum_of_paid_per_boat(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    """GET /trips/{id}/capacity used_capacity equals paid+held seats across boats."""
    boat = Boat(
        name="Small Boat",
        slug="small-boat",
        capacity=20,
        provider_id=test_provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)
    db.add(
        BoatPricing(
            boat_id=boat.id,
            ticket_type="adult",
            price=5000,
            capacity=20,
        )
    )
    from datetime import datetime, timedelta, timezone

    departure = datetime.now(timezone.utc) + timedelta(days=20)
    trip = Trip(
        mission_id=test_mission.id,
        name="Cap Test Trip",
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
    tb = TripBoat(trip_id=trip.id, boat_id=boat.id, max_capacity=None)
    db.add(tb)
    db.commit()

    booking = Booking(
        confirmation_code=f"CAP{uuid.uuid4().hex[:8].upper()}",
        first_name="A",
        last_name="B",
        user_email="a@example.com",
        user_phone="+1",
        billing_address="x",
        subtotal=10000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=10000,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    db.add(
        BookingItem(
            booking_id=booking.id,
            trip_id=trip.id,
            boat_id=boat.id,
            item_type="adult",
            quantity=3,
            price_per_unit=5000,
            status=BookingItemStatus.active,
        )
    )
    db.commit()

    paid = crud.get_paid_ticket_count_per_boat_for_trip(session=db, trip_id=trip.id)
    assert sum(paid.values()) == 3

    r = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}/capacity",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["used_capacity"] == 3
    assert data["total_capacity"] == 20

    r2 = client.get(
        f"{settings.API_V1_STR}/trip-boats/trip/{trip.id}",
        params={"skip": 0, "limit": 500},
        headers=superuser_token_headers,
    )
    assert r2.status_code == 200
    boats = r2.json()
    assert len(boats) == 1
    sum_by_type = sum(boats[0]["used_per_ticket_type"].values())
    assert sum_by_type == data["used_capacity"]


@patch("app.api.routes.payments.release_payment_intent_after_capacity_failure")
@patch("app.api.routes.payments.send_booking_confirmation_email")
@patch("stripe.Webhook.construct_event")
def test_webhook_second_booking_rejected_when_boat_would_overbook(
    mock_construct: MagicMock,
    mock_send_email: MagicMock,
    mock_release: MagicMock,
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    """
    First payment_intent.succeeded confirms; second fails capacity re-check and is
    cancelled with payment failed (Stripe release mocked).
    """
    boat = Boat(
        name="Ten Seater",
        slug="ten-seater",
        capacity=10,
        provider_id=test_provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)
    db.add(
        BoatPricing(
            boat_id=boat.id,
            ticket_type="adult",
            price=1000,
            capacity=10,
        )
    )
    from datetime import datetime, timedelta, timezone

    departure = datetime.now(timezone.utc) + timedelta(days=25)
    trip = Trip(
        mission_id=test_mission.id,
        name="Overbook Trip",
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

    def make_draft(pi: str, code: str) -> Booking:
        b = Booking(
            confirmation_code=code,
            first_name="X",
            last_name="Y",
            user_email=f"{code.lower()}@example.com",
            user_phone="+1",
            billing_address="z",
            subtotal=6000,
            discount_amount=0,
            tax_amount=0,
            tip_amount=0,
            total_amount=6000,
            payment_status=PaymentStatus.pending_payment,
            booking_status=BookingStatus.draft,
            payment_intent_id=pi,
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
        return b

    b1 = make_draft("pi_over_a", f"OB{uuid.uuid4().hex[:6].upper()}")
    b2 = make_draft("pi_over_b", f"OB{uuid.uuid4().hex[:6].upper()}")

    def run_webhook(pi_id: str) -> None:
        mock_construct.return_value = SimpleNamespace(
            type="payment_intent.succeeded",
            data=SimpleNamespace(
                object=SimpleNamespace(id=pi_id, status="succeeded"),
            ),
        )
        with patch.object(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test"):
            r = client.post(
                f"{settings.API_V1_STR}/payments/webhook",
                content=b"{}",
                headers={"stripe-signature": "test_sig"},
            )
        assert r.status_code == 200

    run_webhook("pi_over_a")
    db.refresh(b1)
    assert b1.booking_status == BookingStatus.confirmed
    assert b1.payment_status == PaymentStatus.paid

    run_webhook("pi_over_b")
    db.refresh(b2)
    assert b2.booking_status == BookingStatus.cancelled
    assert b2.payment_status == PaymentStatus.failed
    mock_release.assert_called_once_with("pi_over_b")

    paid = crud.get_paid_ticket_count_per_boat_for_trip(session=db, trip_id=trip.id)
    assert paid.get(boat.id, 0) == 6
    mock_send_email.assert_called_once()
