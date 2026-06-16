"""Tests for boats API routes (boats.py)."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Boat, BoatPricing, Jurisdiction, Provider

BOATS_URL = f"{settings.API_V1_STR}/boats"


def test_list_boats_requires_auth(client: TestClient) -> None:
    r = client.get(BOATS_URL + "/")
    assert r.status_code == 401


def test_list_boats_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
) -> None:
    r = client.get(BOATS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert any(b["id"] == str(test_boat.id) for b in data["data"])


def test_create_boat_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_provider: Provider,
) -> None:
    payload = {
        "name": "New Boat",
        "capacity": 80,
        "provider_id": str(test_provider.id),
    }
    r = client.post(
        BOATS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "New Boat"
    assert r.json()["capacity"] == 80


def test_get_boat_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
) -> None:
    r = client.get(
        f"{BOATS_URL}/{test_boat.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_boat.id)


def test_get_boat_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{BOATS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_boat_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
) -> None:
    r = client.put(
        f"{BOATS_URL}/{test_boat.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Boat Name"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Boat Name"


def test_create_boat_invalid_provider(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        BOATS_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Orphan Boat",
            "capacity": 10,
            "provider_id": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 404


def test_update_boat_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.put(
        f"{BOATS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"name": "Ghost Boat"},
    )
    assert r.status_code == 404


def test_update_boat_capacity_below_booked_passengers(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
    test_trip_boat,
    test_booking_item,
) -> None:
    r = client.put(
        f"{BOATS_URL}/{test_boat.id}",
        headers=superuser_token_headers,
        json={"capacity": 1},
    )
    assert r.status_code == 400
    assert "passengers booked" in r.json()["detail"]


def test_update_boat_capacity_below_pricing_sum(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.put(
        f"{BOATS_URL}/{test_boat.id}",
        headers=superuser_token_headers,
        json={"capacity": 10},
    )
    assert r.status_code == 400
    assert "ticket-type capacities" in r.json()["detail"]


def test_update_boat_invalid_provider(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
) -> None:
    r = client.put(
        f"{BOATS_URL}/{test_boat.id}",
        headers=superuser_token_headers,
        json={"provider_id": str(uuid.uuid4())},
    )
    assert r.status_code == 404


def test_delete_boat_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.delete(
        f"{BOATS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_delete_boat_on_trip_fails(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
    test_trip_boat,
) -> None:
    r = client.delete(
        f"{BOATS_URL}/{test_boat.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
    assert "used on trips" in r.json()["detail"]


def test_delete_boat_with_pricing_fails(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_provider: Provider,
) -> None:
    boat = Boat(
        name="Priced Boat",
        slug="priced-boat",
        capacity=30,
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
            capacity=25,
        )
    )
    db.commit()

    r = client.delete(
        f"{BOATS_URL}/{boat.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
    assert "pricing configured" in r.json()["detail"]


def test_delete_boat_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_provider: Provider,
) -> None:
    boat = Boat(
        name="Deletable Boat",
        slug="deletable-boat",
        capacity=20,
        provider_id=test_provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)

    r = client.delete(
        f"{BOATS_URL}/{boat.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204
    assert db.get(Boat, boat.id) is None


def test_list_boats_by_jurisdiction_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_jurisdiction: Jurisdiction,
    test_boat: Boat,
) -> None:
    r = client.get(
        f"{BOATS_URL}/jurisdiction/{test_jurisdiction.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert any(b["id"] == str(test_boat.id) for b in data["data"])
    boat = next(b for b in data["data"] if b["id"] == str(test_boat.id))
    assert boat["provider_id"] == str(test_boat.provider_id)


def test_list_boats_by_jurisdiction_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{BOATS_URL}/jurisdiction/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_read_public_boat_success(
    client: TestClient,
    test_boat: Boat,
) -> None:
    r = client.get(f"{BOATS_URL}/public/{test_boat.id}")
    assert r.status_code == 200
    assert r.json()["id"] == str(test_boat.id)


def test_read_public_boat_not_found(client: TestClient) -> None:
    r = client.get(f"{BOATS_URL}/public/{uuid.uuid4()}")
    assert r.status_code == 404


def test_read_public_boats_success(
    client: TestClient,
    test_boat: Boat,
) -> None:
    r = client.get(BOATS_URL + "/public/")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert any(b["id"] == str(test_boat.id) for b in data["data"])
