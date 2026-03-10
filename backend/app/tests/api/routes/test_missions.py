"""Tests for missions API routes (missions.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Launch, Mission

MISSIONS_URL = f"{settings.API_V1_STR}/missions"


def test_list_missions_requires_auth(client: TestClient) -> None:
    r = client.get(MISSIONS_URL + "/")
    assert r.status_code == 401


def test_list_missions_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    r = client.get(MISSIONS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert any(m["id"] == str(test_mission.id) for m in data["data"])


def test_create_mission_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    payload = {
        "name": "New Mission",
        "launch_id": str(test_launch.id),
        "active": True,
        "refund_cutoff_hours": 24,
    }
    r = client.post(
        MISSIONS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "New Mission"


def test_create_mission_launch_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    payload = {
        "name": "New Mission",
        "launch_id": str(uuid.uuid4()),
        "active": True,
        "refund_cutoff_hours": 24,
    }
    r = client.post(
        MISSIONS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 404


def test_get_mission_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    r = client.get(
        f"{MISSIONS_URL}/{test_mission.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_mission.id)


def test_get_mission_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{MISSIONS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_mission_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    r = client.put(
        f"{MISSIONS_URL}/{test_mission.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Mission Name"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Mission Name"


def test_duplicate_mission_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    r = client.post(
        f"{MISSIONS_URL}/{test_mission.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"] != str(test_mission.id)
