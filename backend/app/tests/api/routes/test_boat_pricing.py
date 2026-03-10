"""Tests for boat-pricing API routes (boat_pricing.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Boat, BoatPricing

BOAT_PRICING_URL = f"{settings.API_V1_STR}/boat-pricing"


def test_list_boat_pricing_requires_auth(client: TestClient) -> None:
    r = client.get(BOAT_PRICING_URL + "/")
    assert r.status_code == 401


def test_list_boat_pricing_by_boat_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.get(
        BOAT_PRICING_URL + "/",
        headers=superuser_token_headers,
        params={"boat_id": str(test_boat.id)},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(p["ticket_type"] == test_boat_pricing.ticket_type for p in data)


def test_create_boat_pricing_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
) -> None:
    payload = {
        "boat_id": str(test_boat.id),
        "ticket_type": "child",
        "price": 2500,
        "capacity": 20,
    }
    r = client.post(
        BOAT_PRICING_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["ticket_type"] == "child"
    assert r.json()["price"] == 2500


def test_get_boat_pricing_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.get(
        f"{BOAT_PRICING_URL}/{test_boat_pricing.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_boat_pricing.id)


def test_get_boat_pricing_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{BOAT_PRICING_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
