"""Tests for locations API routes (locations.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Location

LOCATIONS_URL = f"{settings.API_V1_STR}/locations"


def test_list_locations_requires_auth(client: TestClient) -> None:
    r = client.get(LOCATIONS_URL + "/")
    assert r.status_code == 401


def test_list_locations_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: Location,
) -> None:
    r = client.get(LOCATIONS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert any(loc["id"] == str(test_location.id) for loc in data["data"])


def test_create_location_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    payload = {"name": "New Location", "state": "TX", "timezone": "America/Chicago"}
    r = client.post(
        LOCATIONS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "New Location"


def test_get_location_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: Location,
) -> None:
    r = client.get(
        f"{LOCATIONS_URL}/{test_location.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_location.id)


def test_get_location_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{LOCATIONS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_location_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: Location,
) -> None:
    r = client.put(
        f"{LOCATIONS_URL}/{test_location.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Location Name"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Location Name"


def test_delete_location_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.delete(
        f"{LOCATIONS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
