"""Tests for missions API routes (missions.py)."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Launch, Mission, Trip

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


def test_duplicate_mission_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{MISSIONS_URL}/{uuid.uuid4()}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_delete_mission_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_launch: Launch,
) -> None:
    mission = Mission(
        name="Deletable Mission",
        launch_id=test_launch.id,
        active=True,
        refund_cutoff_hours=12,
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    r = client.delete(
        f"{MISSIONS_URL}/{mission.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204
    assert db.get(Mission, mission.id) is None


def test_delete_mission_with_trips_fails(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip,
) -> None:
    r = client.delete(
        f"{MISSIONS_URL}/{test_mission.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
    assert "trip" in r.json()["detail"].lower()


def test_delete_mission_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.delete(
        f"{MISSIONS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_mission_launch_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    r = client.put(
        f"{MISSIONS_URL}/{test_mission.id}",
        headers=superuser_token_headers,
        json={"launch_id": str(uuid.uuid4())},
    )
    assert r.status_code == 404


def test_update_mission_archive(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_mission: Mission,
    test_trip: Trip,
) -> None:
    r = client.put(
        f"{MISSIONS_URL}/{test_mission.id}",
        headers=superuser_token_headers,
        json={"archived": True},
    )
    assert r.status_code == 200
    db.refresh(test_mission)
    db.refresh(test_trip)
    assert test_mission.archived is True
    assert test_trip.archived is True


def test_read_missions_by_launch(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
    test_mission: Mission,
) -> None:
    r = client.get(
        f"{MISSIONS_URL}/launch/{test_launch.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert any(m["id"] == str(test_mission.id) for m in data["data"])
    assert data["data"][0]["timezone"] is not None


def test_read_missions_by_launch_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{MISSIONS_URL}/launch/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_read_active_missions(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    r = client.get(
        MISSIONS_URL + "/active/",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert any(m["id"] == str(test_mission.id) for m in r.json()["data"])


def test_read_public_missions(
    client: TestClient,
    test_mission: Mission,
) -> None:
    r = client.get(MISSIONS_URL + "/public/")
    assert r.status_code == 200
    assert "data" in r.json()


def test_import_mission_yaml_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_launch: Launch,
) -> None:
    yaml_content = (
        f'name: "Imported Mission"\n'
        f'launch_id: "{test_launch.id}"\n'
        f"active: true\n"
        f"refund_cutoff_hours: 24\n"
    )
    r = client.post(
        f"{MISSIONS_URL}/import-yaml",
        headers=superuser_token_headers,
        files={"file": ("mission.yaml", yaml_content.encode(), "text/yaml")},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Imported Mission"


def test_import_mission_yaml_invalid_extension(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{MISSIONS_URL}/import-yaml",
        headers=superuser_token_headers,
        files={"file": ("mission.txt", b"name: x", "text/plain")},
    )
    assert r.status_code == 400


def test_list_missions_include_archived(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_mission: Mission,
) -> None:
    test_mission.archived = True
    db.add(test_mission)
    db.commit()

    r = client.get(
        MISSIONS_URL + "/",
        headers=superuser_token_headers,
        params={"include_archived": "true"},
    )
    assert r.status_code == 200
    assert any(m["id"] == str(test_mission.id) for m in r.json()["data"])
