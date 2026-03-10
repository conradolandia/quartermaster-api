"""Tests for boats API routes (boats.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Boat, Provider

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
