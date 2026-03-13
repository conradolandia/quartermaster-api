"""Tests for trip-boat-pricing API routes."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import TripBoat, TripBoatPricing

PRICING_URL = f"{settings.API_V1_STR}/trip-boat-pricing"


def test_delete_trip_boat_pricing_when_type_in_use_returns_400(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
    test_booking_item,
) -> None:
    """DELETE returns 400 when the ticket type still has passengers."""
    r = client.delete(
        f"{PRICING_URL}/{test_trip_boat_pricing.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
    assert "still has passengers" in r.json().get("detail", "")


def test_delete_trip_boat_pricing_when_type_not_in_use_returns_204(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_trip_boat: TripBoat,
) -> None:
    """DELETE returns 204 when the ticket type has no passengers."""
    pricing = TripBoatPricing(
        trip_boat_id=test_trip_boat.id,
        ticket_type="child",
        price=3000,
        capacity=10,
    )
    db.add(pricing)
    db.commit()
    db.refresh(pricing)

    r = client.delete(
        f"{PRICING_URL}/{pricing.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204
