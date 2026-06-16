"""Tests for trip-boat-pricing API routes."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import TripBoat, TripBoatPricing

PRICING_URL = f"{settings.API_V1_STR}/trip-boat-pricing"


def test_list_trip_boat_pricing_empty_without_trip_boat_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(PRICING_URL, headers=superuser_token_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_list_trip_boat_pricing_by_trip_boat_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    r = client.get(
        PRICING_URL,
        params={"trip_boat_id": str(test_trip_boat.id)},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert any(p["id"] == str(test_trip_boat_pricing.id) for p in data)


def test_get_trip_boat_pricing(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
) -> None:
    r = client.get(
        f"{PRICING_URL}/{test_trip_boat_pricing.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_trip_boat_pricing.id)
    assert r.json()["ticket_type"] == "adult"


def test_get_trip_boat_pricing_404(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    import uuid

    r = client.get(
        f"{PRICING_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_create_trip_boat_pricing_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat: TripBoat,
) -> None:
    payload = {
        "trip_boat_id": str(test_trip_boat.id),
        "ticket_type": "child",
        "price": 3000,
        "capacity": 10,
    }
    r = client.post(PRICING_URL, headers=superuser_token_headers, json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["ticket_type"] == "child"
    assert data["price"] == 3000
    assert data["capacity"] == 10


def test_create_trip_boat_pricing_duplicate_returns_400(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    payload = {
        "trip_boat_id": str(test_trip_boat.id),
        "ticket_type": "adult",
        "price": 5500,
        "capacity": 20,
    }
    r = client.post(PRICING_URL, headers=superuser_token_headers, json=payload)
    assert r.status_code == 400
    assert "already exists" in r.json().get("detail", "").lower()


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


def test_create_trip_boat_pricing_trip_boat_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    import uuid

    r = client.post(
        PRICING_URL,
        headers=superuser_token_headers,
        json={
            "trip_boat_id": str(uuid.uuid4()),
            "ticket_type": "senior",
            "price": 4000,
            "capacity": 5,
        },
    )
    assert r.status_code == 404


def test_create_trip_boat_pricing_capacity_exceeds_max(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat: TripBoat,
    test_boat_pricing,
) -> None:
    r = client.post(
        PRICING_URL,
        headers=superuser_token_headers,
        json={
            "trip_boat_id": str(test_trip_boat.id),
            "ticket_type": "child",
            "price": 3000,
            "capacity": 50,
        },
    )
    assert r.status_code == 400
    assert "would exceed" in r.json()["detail"]


def test_update_trip_boat_pricing_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
) -> None:
    r = client.put(
        f"{PRICING_URL}/{test_trip_boat_pricing.id}",
        headers=superuser_token_headers,
        json={"price": 6500, "capacity": 30},
    )
    assert r.status_code == 200
    assert r.json()["price"] == 6500
    assert r.json()["capacity"] == 30


def test_update_trip_boat_pricing_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    import uuid

    r = client.put(
        f"{PRICING_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"price": 1000},
    )
    assert r.status_code == 404


def test_update_trip_boat_pricing_duplicate_ticket_type(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
    test_trip_boat: TripBoat,
    db: Session,
) -> None:
    db.add(
        TripBoatPricing(
            trip_boat_id=test_trip_boat.id,
            ticket_type="child",
            price=3000,
            capacity=10,
        )
    )
    db.commit()

    r = client.put(
        f"{PRICING_URL}/{test_trip_boat_pricing.id}",
        headers=superuser_token_headers,
        json={"ticket_type": "child"},
    )
    assert r.status_code == 400
    assert "already exists" in r.json()["detail"]


def test_update_trip_boat_pricing_capacity_exceeds_max(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip_boat_pricing: TripBoatPricing,
    test_trip_boat: TripBoat,
) -> None:
    r = client.put(
        f"{PRICING_URL}/{test_trip_boat_pricing.id}",
        headers=superuser_token_headers,
        json={"capacity": 999},
    )
    assert r.status_code == 400
    assert "would exceed" in r.json()["detail"]


def test_delete_trip_boat_pricing_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    import uuid

    r = client.delete(
        f"{PRICING_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
