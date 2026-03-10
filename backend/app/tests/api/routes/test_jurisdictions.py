"""Tests for jurisdictions API routes (jurisdictions.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Jurisdiction

JURISDICTIONS_URL = f"{settings.API_V1_STR}/jurisdictions"


def test_list_jurisdictions_requires_auth(client: TestClient) -> None:
    r = client.get(JURISDICTIONS_URL + "/")
    assert r.status_code == 401


def test_list_jurisdictions_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_jurisdiction: Jurisdiction,
) -> None:
    r = client.get(JURISDICTIONS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert any(j["id"] == str(test_jurisdiction.id) for j in data["data"])


def test_public_jurisdictions_no_auth(
    client: TestClient, test_jurisdiction: Jurisdiction
) -> None:
    r = client.get(JURISDICTIONS_URL + "/public/")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data


def test_create_jurisdiction_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_location: "object",
) -> None:
    from app.models import Location

    loc = test_location
    assert isinstance(loc, Location)
    payload = {
        "name": "New Jurisdiction",
        "sales_tax_rate": 0.08,
        "location_id": str(loc.id),
    }
    r = client.post(
        JURISDICTIONS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "New Jurisdiction"


def test_get_jurisdiction_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_jurisdiction: Jurisdiction,
) -> None:
    r = client.get(
        f"{JURISDICTIONS_URL}/{test_jurisdiction.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_jurisdiction.id)


def test_get_jurisdiction_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{JURISDICTIONS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_jurisdiction_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_jurisdiction: Jurisdiction,
) -> None:
    r = client.put(
        f"{JURISDICTIONS_URL}/{test_jurisdiction.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Jurisdiction"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Jurisdiction"
