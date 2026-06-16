"""Tests for trip operations routes (trips_operations.py)."""

import io
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Mission

TRIPS_URL = f"{settings.API_V1_STR}/trips"


def test_import_yaml_requires_auth(client: TestClient) -> None:
    r = client.post(
        f"{TRIPS_URL}/import-yaml",
        files={"file": ("trip.yaml", b"mission_id: x", "text/yaml")},
    )
    assert r.status_code == 401


def test_import_yaml_rejects_non_yaml_extension(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{TRIPS_URL}/import-yaml",
        headers=superuser_token_headers,
        files={"file": ("trip.txt", b"mission_id: x", "text/plain")},
    )
    assert r.status_code == 400
    assert "YAML file" in r.json()["detail"]


def test_import_yaml_validation_error(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{TRIPS_URL}/import-yaml",
        headers=superuser_token_headers,
        files={"file": ("trip.yaml", b"not: valid trip yaml", "text/yaml")},
    )
    assert r.status_code == 400
    assert "YAML validation error" in r.json()["detail"]


def test_import_yaml_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=60)
    yaml_content = (
        f"mission_id: {test_mission.id}\n"
        f'type: "launch_viewing"\n'
        f'departure_time: "{departure.isoformat().replace("+00:00", "Z")}"\n'
        f'name: "YAML Imported Trip"\n'
    )
    r = client.post(
        f"{TRIPS_URL}/import-yaml",
        headers=superuser_token_headers,
        files={"file": ("trip.yaml", yaml_content.encode(), "text/yaml")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "YAML Imported Trip"
    assert data["mission_id"] == str(test_mission.id)


def test_import_yaml_internal_error(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch,
) -> None:
    class BrokenImporter:
        def __init__(self, session):
            self.session = session

        def import_trip(self, yaml_content: str):
            raise RuntimeError("boom")

    monkeypatch.setattr(
        "app.api.routes.trips_operations.YamlImporter",
        BrokenImporter,
    )
    r = client.post(
        f"{TRIPS_URL}/import-yaml",
        headers=superuser_token_headers,
        files={
            "file": (
                "trip.yaml",
                io.BytesIO(b"mission_id: x\ntype: launch_viewing\n"),
                "text/yaml",
            )
        },
    )
    assert r.status_code == 500
    assert "Failed to import trip" in r.json()["detail"]
