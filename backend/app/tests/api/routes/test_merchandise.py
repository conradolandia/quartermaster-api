"""Tests for merchandise API routes (merchandise.py)."""

import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Merchandise

MERCHANDISE_URL = f"{settings.API_V1_STR}/merchandise"


def test_list_merchandise_requires_auth(client: TestClient) -> None:
    r = client.get(MERCHANDISE_URL + "/")
    assert r.status_code == 401


def test_list_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(MERCHANDISE_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    payload = {
        "name": "Test Cap",
        "description": "A cap",
        "price": 1500,
        "quantity_available": 10,
    }
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Test Cap"


def test_get_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_merchandise: Merchandise,
) -> None:
    r = client.get(
        f"{MERCHANDISE_URL}/{test_merchandise.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_merchandise.id)


def test_get_merchandise_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{MERCHANDISE_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
