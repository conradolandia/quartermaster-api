"""Tests for crud.bookings.create_booking_impl (direct function calls)."""

import uuid

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.crud.bookings import create_booking_impl
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingCreate,
    BookingItemCreate,
    BookingItemStatus,
    BookingStatus,
    Mission,
    Trip,
    TripBoat,
    User,
)


def _make_item(
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    price: int = 5000,
    quantity: int = 1,
    item_type: str = "adult",
) -> BookingItemCreate:
    return BookingItemCreate(
        trip_id=trip_id,
        boat_id=boat_id,
        item_type=item_type,
        quantity=quantity,
        price_per_unit=price,
        status=BookingItemStatus.active,
    )


def _make_payload(
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    price: int = 5000,
    quantity: int = 1,
    **overrides,
) -> BookingCreate:
    total = price * quantity
    defaults = {
        "confirmation_code": uuid.uuid4().hex[:8].upper(),
        "first_name": "Jane",
        "last_name": "Doe",
        "user_email": "jane@example.com",
        "user_phone": "+1234567890",
        "billing_address": "123 Test St",
        "subtotal": total,
        "discount_amount": 0,
        "tax_amount": 0,
        "tip_amount": 0,
        "total_amount": total,
        "items": [_make_item(trip_id, boat_id, price=price, quantity=quantity)],
    }
    defaults.update(overrides)
    return BookingCreate(**defaults)


# --- Success path ---


def test_create_booking_returns_booking_with_items(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    booking = create_booking_impl(session=db, booking_in=payload, current_user=None)

    assert isinstance(booking, Booking)
    assert booking.booking_status == BookingStatus.draft
    assert booking.payment_status is None
    assert booking.qr_code_base64 is not None
    assert len(booking.items) == 1
    assert booking.items[0].item_type == "adult"
    assert booking.items[0].quantity == 1


def test_create_booking_superuser_bypasses_private_trip(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    test_trip.booking_mode = "private"
    db.add(test_trip)
    db.commit()

    superuser = db.exec(
        __import__("sqlmodel", fromlist=["select"])
        .select(User)
        .where(
            User.is_superuser == True  # noqa: E712
        )
    ).first()
    assert superuser is not None

    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    booking = create_booking_impl(
        session=db, booking_in=payload, current_user=superuser
    )
    assert booking.booking_status == BookingStatus.draft


# --- Validation errors ---


def test_empty_items_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    payload = _make_payload(test_trip.id, test_boat.id)
    payload.items = []
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "at least one item" in exc.value.detail.lower()


def test_nonexistent_trip_raises(
    db: Session,
    test_boat: Boat,
    test_trip_boat: TripBoat,
) -> None:
    fake_trip_id = uuid.uuid4()
    payload = _make_payload(fake_trip_id, test_boat.id)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 404


def test_inactive_trip_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    test_trip.active = False
    db.add(test_trip)
    db.commit()

    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "not active" in exc.value.detail.lower()


def test_inactive_mission_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
    test_mission: Mission,
) -> None:
    test_mission.active = False
    db.add(test_mission)
    db.commit()

    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "not active" in exc.value.detail.lower()


def test_items_from_different_missions_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
    test_launch,
) -> None:
    from datetime import datetime, timedelta, timezone

    other_mission = Mission(
        name="Other Mission",
        launch_id=test_launch.id,
        active=True,
        refund_cutoff_hours=24,
    )
    db.add(other_mission)
    db.commit()
    db.refresh(other_mission)

    departure = datetime.now(timezone.utc) + timedelta(days=30)
    other_trip = Trip(
        mission_id=other_mission.id,
        name="Other Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(other_trip)
    db.commit()
    db.refresh(other_trip)

    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    payload.items.append(
        _make_item(other_trip.id, test_boat.id, price=test_boat_pricing.price)
    )
    payload.subtotal = test_boat_pricing.price * 2
    payload.total_amount = test_boat_pricing.price * 2

    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "same mission" in exc.value.detail.lower()


def test_boat_not_on_trip_raises(
    db: Session,
    test_trip: Trip,
    test_boat_pricing: BoatPricing,
    test_provider,
) -> None:
    orphan_boat = Boat(
        name="Orphan Boat",
        slug="orphan-boat",
        capacity=50,
        provider_id=test_provider.id,
    )
    db.add(orphan_boat)
    db.commit()
    db.refresh(orphan_boat)

    payload = _make_payload(test_trip.id, orphan_boat.id)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "not associated" in exc.value.detail.lower()


def test_sales_disabled_on_boat_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    test_trip_boat.sales_enabled = False
    db.add(test_trip_boat)
    db.commit()

    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "disabled" in exc.value.detail.lower()


def test_price_mismatch_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    wrong_price = test_boat_pricing.price + 100
    payload = _make_payload(test_trip.id, test_boat.id, price=wrong_price)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "price mismatch" in exc.value.detail.lower()


def test_duplicate_confirmation_code_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    code = "DUPECODE1"
    payload1 = _make_payload(
        test_trip.id,
        test_boat.id,
        price=test_boat_pricing.price,
        confirmation_code=code,
    )
    create_booking_impl(session=db, booking_in=payload1, current_user=None)

    payload2 = _make_payload(
        test_trip.id,
        test_boat.id,
        price=test_boat_pricing.price,
        confirmation_code=code,
    )
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload2, current_user=None)
    assert exc.value.status_code == 400
    assert "already exists" in exc.value.detail.lower()


def test_capacity_exceeded_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    over = test_boat_pricing.capacity + 1
    payload = _make_payload(
        test_trip.id,
        test_boat.id,
        price=test_boat_pricing.price,
        quantity=over,
    )
    payload.subtotal = test_boat_pricing.price * over
    payload.total_amount = test_boat_pricing.price * over
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 400
    assert "exceed capacity" in exc.value.detail.lower()


def test_private_trip_no_user_raises(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    test_trip.booking_mode = "private"
    db.add(test_trip)
    db.commit()

    payload = _make_payload(test_trip.id, test_boat.id, price=test_boat_pricing.price)
    with pytest.raises(HTTPException) as exc:
        create_booking_impl(session=db, booking_in=payload, current_user=None)
    assert exc.value.status_code == 403
