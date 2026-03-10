"""Tests for API dependency injection (api/deps.py)."""

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.security import create_access_token
from app.models import UserCreate
from app.tests.utils.utils import (
    get_superuser_token_headers,
    random_email,
    random_lower_string,
)


def _booking_payload(
    *,
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    price_per_unit: int = 5000,
    confirmation_code: str = "OPT",
) -> dict:
    """Minimal valid BookingCreate payload for POST /bookings/."""
    return {
        "confirmation_code": confirmation_code,
        "first_name": "A",
        "last_name": "B",
        "user_email": "a@b.com",
        "user_phone": "+1234567890",
        "billing_address": "123 St",
        "subtotal": price_per_unit,
        "discount_amount": 0,
        "tax_amount": 0,
        "tip_amount": 0,
        "total_amount": price_per_unit,
        "items": [
            {
                "trip_id": str(trip_id),
                "boat_id": str(boat_id),
                "item_type": "adult",
                "quantity": 1,
                "price_per_unit": price_per_unit,
                "status": "active",
            }
        ],
    }


def test_protected_endpoint_invalid_token_returns_403(client: TestClient) -> None:
    """get_current_user: invalid token raises 403 (covers deps except InvalidTokenError/ValidationError)."""
    r = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert r.status_code == 403
    assert "Could not validate credentials" in (r.json().get("detail") or "")


def test_protected_endpoint_user_not_found_returns_404(
    client: TestClient,
    db: Session,
) -> None:
    """get_current_user: token valid but user deleted -> 404."""
    headers = get_superuser_token_headers(client)
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert r.status_code == 200
    user = crud.get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None
    db.delete(user)
    db.commit()
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert r.status_code == 404
    assert "User not found" in (r.json().get("detail") or "")


def test_protected_endpoint_inactive_user_returns_4xx(
    client: TestClient,
    db: Session,
) -> None:
    """get_current_user: token valid but user is_active=False -> 400 or 403 (denied)."""
    email = random_email()
    password = random_lower_string()
    user = crud.create_user(
        session=db,
        user_create=UserCreate(
            email=email,
            password=password,
            is_active=False,
            is_superuser=False,
        ),
    )
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), timedelta(minutes=15))
    r = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code in (400, 403)
    if r.status_code == 400:
        assert "Inactive user" in (r.json().get("detail") or "")


def test_superuser_endpoint_non_superuser_returns_403(
    client: TestClient,
    db: Session,
) -> None:
    """get_current_active_superuser: non-superuser -> 403."""
    user = crud.create_user(
        session=db,
        user_create=UserCreate(
            email=random_email(),
            password=random_lower_string(),
            is_active=True,
            is_superuser=False,
        ),
    )
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), timedelta(minutes=15))
    r = client.get(
        f"{settings.API_V1_STR}/bookings/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert "enough privileges" in (r.json().get("detail") or "").lower()


def test_optional_user_no_auth(
    client: TestClient,
    test_trip: "object",
    test_boat: "object",
    test_boat_pricing: "object",
    test_trip_boat: "object",
) -> None:
    """get_optional_current_user: no Authorization header -> None (endpoint still works)."""
    from app.models import Boat, BoatPricing, Trip

    trip = test_trip
    boat = test_boat
    assert isinstance(trip, Trip)
    assert isinstance(boat, Boat)
    assert isinstance(test_boat_pricing, BoatPricing)
    payload = _booking_payload(
        trip_id=trip.id,
        boat_id=boat.id,
        price_per_unit=test_boat_pricing.price,
        confirmation_code="OPT1",
    )
    r = client.post(f"{settings.API_V1_STR}/bookings/", json=payload)
    assert r.status_code == 201


def test_optional_user_invalid_token(
    client: TestClient,
    test_trip: "object",
    test_boat: "object",
    test_boat_pricing: "object",
    test_trip_boat: "object",
) -> None:
    """get_optional_current_user: invalid token -> None (endpoint still works)."""
    from app.models import Boat, BoatPricing, Trip

    trip = test_trip
    boat = test_boat
    assert isinstance(trip, Trip)
    assert isinstance(boat, Boat)
    assert isinstance(test_boat_pricing, BoatPricing)
    payload = _booking_payload(
        trip_id=trip.id,
        boat_id=boat.id,
        price_per_unit=test_boat_pricing.price,
        confirmation_code="OPT2",
    )
    r = client.post(
        f"{settings.API_V1_STR}/bookings/",
        json=payload,
        headers={"Authorization": "Bearer invalid"},
    )
    assert r.status_code == 201


def test_optional_user_malformed_auth(
    client: TestClient,
    test_trip: "object",
    test_boat: "object",
    test_boat_pricing: "object",
    test_trip_boat: "object",
) -> None:
    """get_optional_current_user: malformed Authorization (no Bearer) -> None."""
    from app.models import Boat, BoatPricing, Trip

    trip = test_trip
    boat = test_boat
    assert isinstance(trip, Trip)
    assert isinstance(boat, Boat)
    assert isinstance(test_boat_pricing, BoatPricing)
    payload = _booking_payload(
        trip_id=trip.id,
        boat_id=boat.id,
        price_per_unit=test_boat_pricing.price,
        confirmation_code="OPT3",
    )
    r = client.post(
        f"{settings.API_V1_STR}/bookings/",
        json=payload,
        headers={"Authorization": "Basic xyz"},
    )
    assert r.status_code == 201


def test_optional_user_valid_token(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: "object",
    test_boat: "object",
    test_boat_pricing: "object",
    test_trip_boat: "object",
) -> None:
    """get_optional_current_user: valid token -> user returned (endpoint receives current_user)."""
    from app.models import Boat, BoatPricing, Trip

    trip = test_trip
    boat = test_boat
    assert isinstance(trip, Trip)
    assert isinstance(boat, Boat)
    assert isinstance(test_boat_pricing, BoatPricing)
    payload = _booking_payload(
        trip_id=trip.id,
        boat_id=boat.id,
        price_per_unit=test_boat_pricing.price,
        confirmation_code="OPT4",
    )
    r = client.post(
        f"{settings.API_V1_STR}/bookings/",
        json=payload,
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
