"""Tests for providers API routes (providers.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Provider

PROVIDERS_URL = f"{settings.API_V1_STR}/providers"


def test_list_providers_requires_auth(client: TestClient) -> None:
    r = client.get(PROVIDERS_URL + "/")
    assert r.status_code == 401


def test_list_providers_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_provider: Provider,
) -> None:
    r = client.get(PROVIDERS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert any(p["id"] == str(test_provider.id) for p in data["data"])


def test_public_providers_no_auth(client: TestClient, test_provider: Provider) -> None:
    r = client.get(PROVIDERS_URL + "/public/")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data


def test_create_provider_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_jurisdiction: "object",
) -> None:
    from app.models import Jurisdiction

    jur = test_jurisdiction
    assert isinstance(jur, Jurisdiction)
    payload = {
        "name": "New Provider",
        "location": "123 New St",
        "address": "123 New St, City, ST 00000",
        "jurisdiction_id": str(jur.id),
    }
    r = client.post(
        PROVIDERS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "New Provider"


def test_get_provider_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_provider: Provider,
) -> None:
    r = client.get(
        f"{PROVIDERS_URL}/{test_provider.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_provider.id)


def test_get_provider_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{PROVIDERS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_provider_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_provider: Provider,
) -> None:
    r = client.put(
        f"{PROVIDERS_URL}/{test_provider.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Provider"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Provider"
