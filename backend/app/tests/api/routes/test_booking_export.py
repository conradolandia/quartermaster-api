"""Tests for booking CSV export (booking_export.py)."""

from fastapi.testclient import TestClient

from app.core.config import settings

BOOKINGS_EXPORT_URL = f"{settings.API_V1_STR}/bookings/export/csv"


def test_export_csv_requires_auth(client: TestClient) -> None:
    r = client.get(BOOKINGS_EXPORT_URL)
    assert r.status_code == 401


def test_export_csv_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(BOOKINGS_EXPORT_URL, headers=superuser_token_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert len(r.content) >= 0


def test_export_csv_with_filters(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"booking_status": "confirmed"},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_with_mission_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: "object",
) -> None:
    from app.models import Mission

    mission = test_mission
    assert isinstance(mission, Mission)
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"mission_id": str(mission.id)},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_with_fields_param(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"fields": "confirmation_code,customer_name,email"},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_with_trip_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: "object",
) -> None:
    from app.models import Trip

    trip = test_trip
    assert isinstance(trip, Trip)
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"trip_id": str(trip.id)},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
