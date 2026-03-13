"""Tests for admin trip endpoints (trips_admin.py)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Boat, BookingItem, Mission, Trip, TripBoat, TripBoatPricing

TRIPS_URL = f"{settings.API_V1_STR}/trips"


def test_list_trips_requires_auth(client: TestClient) -> None:
    r = client.get(TRIPS_URL + "/")
    assert r.status_code == 401


def test_list_trips_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.get(TRIPS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert data["count"] >= 1
    trip_ids = [t["id"] for t in data["data"]]
    assert str(test_trip.id) in trip_ids


def test_list_trips_filter_mission(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_mission: Mission,
) -> None:
    r = client.get(
        TRIPS_URL + "/",
        headers=superuser_token_headers,
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    data = r.json()
    assert all(t["mission_id"] == str(test_mission.id) for t in data["data"])


def test_get_trip_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.get(
        f"{TRIPS_URL}/{test_trip.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_trip.id)


def test_get_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{TRIPS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_create_trip_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=45)
    payload = {
        "mission_id": str(test_mission.id),
        "name": "New Admin Trip",
        "type": "launch_viewing",
        "active": True,
        "booking_mode": "public",
        "departure_time": departure.isoformat(),
    }
    r = client.post(
        TRIPS_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "New Admin Trip"
    assert data["type"] == "launch_viewing"


def test_duplicate_trip_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"] != str(test_trip.id)
    assert "(copy)" in (data.get("name") or "")


def test_read_trip_capacity_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.get(
        f"{TRIPS_URL}/{test_trip.id}/capacity",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "total_capacity" in data
    assert "used_capacity" in data


def test_update_trip_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.put(
        f"{TRIPS_URL}/{test_trip.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Trip Name"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Trip Name"


def test_reassign_same_boat_remaps_types(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat: Boat,
    test_trip_boat: TripBoat,
    test_trip_boat_pricing: TripBoatPricing,
    test_booking_item: BookingItem,
) -> None:
    """Reassign with from_boat_id == to_boat_id remaps ticket types on same boat."""
    db.add(
        TripBoatPricing(
            trip_boat_id=test_trip_boat.id,
            ticket_type="child",
            price=3000,
            capacity=20,
        )
    )
    db.commit()

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(test_boat.id),
            "to_boat_id": str(test_boat.id),
            "type_mapping": {"adult": "child"},
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["moved"] == test_booking_item.quantity

    db.refresh(test_booking_item)
    assert test_booking_item.boat_id == test_boat.id
    assert test_booking_item.item_type == "child"
