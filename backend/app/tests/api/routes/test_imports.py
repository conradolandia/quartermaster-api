"""Tests for multi-entity YAML import routes (imports.py)."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Location, Mission

IMPORT_URL = f"{settings.API_V1_STR}/import/yaml"


def test_import_yaml_requires_auth(client: TestClient) -> None:
    r = client.post(
        IMPORT_URL,
        files={"file": ("doc.yaml", b"launches: []", "text/yaml")},
    )
    assert r.status_code == 401


def test_import_yaml_invalid_extension(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        IMPORT_URL,
        headers=superuser_token_headers,
        files={"file": ("doc.txt", b"launches: []", "text/plain")},
    )
    assert r.status_code == 400


def test_import_yaml_validation_error(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        IMPORT_URL,
        headers=superuser_token_headers,
        files={"file": ("doc.yaml", b"invalid: yaml", "text/yaml")},
    )
    assert r.status_code == 400
    assert "YAML validation error" in r.json()["detail"]


def test_import_yaml_document_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: Location,
    test_mission: Mission,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=90)
    yaml_content = f"""
launches:
  - name: "Import Launch"
    launch_timestamp: "{(datetime.now(timezone.utc) + timedelta(days=60)).isoformat().replace("+00:00", "Z")}"
    summary: "Imported launch"
    location_id: "{test_location.id}"
missions:
  - name: "Import Mission"
    launch_ref: 0
    active: true
    refund_cutoff_hours: 24
trips:
  - name: "Import Trip"
    mission_ref: 0
    type: "launch_viewing"
    departure_time: "{departure.isoformat().replace("+00:00", "Z")}"
"""
    r = client.post(
        IMPORT_URL,
        headers=superuser_token_headers,
        files={"file": ("doc.yaml", yaml_content.encode(), "text/yaml")},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["launches"]) == 1
    assert len(data["missions"]) == 1
    assert len(data["trips"]) == 1


def test_import_yaml_internal_error(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    monkeypatch,
) -> None:
    class BrokenImporter:
        def __init__(self, session):
            self.session = session

        def import_document(self, yaml_content: str):
            raise RuntimeError("boom")

    monkeypatch.setattr(
        "app.api.routes.imports.YamlImporter",
        BrokenImporter,
    )
    r = client.post(
        IMPORT_URL,
        headers=superuser_token_headers,
        files={"file": ("doc.yaml", b"launches: []\n", "text/yaml")},
    )
    assert r.status_code == 500
    assert "Failed to import" in r.json()["detail"]
