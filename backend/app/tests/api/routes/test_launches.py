"""Tests for launches API routes (launches.py)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Launch, Location

LAUNCHES_URL = f"{settings.API_V1_STR}/launches"


def test_list_launches_requires_auth(client: TestClient) -> None:
    r = client.get(LAUNCHES_URL + "/")
    assert r.status_code == 401


def test_list_launches_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.get(LAUNCHES_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert data["count"] >= 1
    launch_ids = [launch["id"] for launch in data["data"]]
    assert str(test_launch.id) in launch_ids


def test_create_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: Location,
) -> None:
    launch_time = datetime.now(timezone.utc) + timedelta(days=60)
    payload = {
        "name": "New Launch",
        "location_id": str(test_location.id),
        "launch_timestamp": launch_time.isoformat(),
        "summary": "Test summary",
    }
    r = client.post(
        LAUNCHES_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "New Launch"
    assert data["summary"] == "Test summary"


def test_create_launch_location_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    launch_time = datetime.now(timezone.utc) + timedelta(days=60)
    payload = {
        "name": "New Launch",
        "location_id": str(uuid.uuid4()),
        "launch_timestamp": launch_time.isoformat(),
        "summary": "Test",
    }
    r = client.post(
        LAUNCHES_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 404


def test_get_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.get(
        f"{LAUNCHES_URL}/{test_launch.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_launch.id)


def test_get_launch_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{LAUNCHES_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_duplicate_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.post(
        f"{LAUNCHES_URL}/{test_launch.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"] != str(test_launch.id)
    assert "(copy)" in (data.get("name") or "")


def test_update_launch_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    r = client.put(
        f"{LAUNCHES_URL}/{test_launch.id}",
        headers=superuser_token_headers,
        json={"summary": "Updated summary"},
    )
    assert r.status_code == 200
    assert r.json()["summary"] == "Updated summary"
