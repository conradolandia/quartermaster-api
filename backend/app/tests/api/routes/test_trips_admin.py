"""Tests for admin trip endpoints (trips_admin.py)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    BookingItem,
    Mission,
    Trip,
    TripBoat,
    TripBoatPricing,
    TripMerchandise,
)

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


def test_list_trips_includes_trip_boats(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_trip_boat: TripBoat,
) -> None:
    r = client.get(TRIPS_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    trip = next(t for t in r.json()["data"] if t["id"] == str(test_trip.id))
    assert len(trip["trip_boats"]) >= 1
    assert trip["trip_boats"][0]["boat_id"] == str(test_trip_boat.boat_id)


def test_create_trip_mission_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=45)
    r = client.post(
        TRIPS_URL + "/",
        headers=superuser_token_headers,
        json={
            "mission_id": str(uuid.uuid4()),
            "name": "Orphan Trip",
            "type": "launch_viewing",
            "departure_time": departure.isoformat(),
        },
    )
    assert r.status_code == 404


def test_create_trip_with_default_offsets(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=50)
    r = client.post(
        TRIPS_URL + "/",
        headers=superuser_token_headers,
        json={
            "mission_id": str(test_mission.id),
            "name": "Default Offsets Trip",
            "type": "launch_viewing",
            "departure_time": departure.isoformat(),
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["check_in_time"] is not None
    assert data["boarding_time"] is not None


def test_create_trip_full_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_boat: Boat,
    test_merchandise,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=55)
    r = client.post(
        f"{TRIPS_URL}/create-full",
        headers=superuser_token_headers,
        json={
            "mission_id": str(test_mission.id),
            "name": "Full Trip",
            "type": "launch_viewing",
            "departure_time": departure.isoformat(),
            "boats": [
                {
                    "boat_id": str(test_boat.id),
                    "max_capacity": 50,
                    "pricing": [
                        {
                            "ticket_type": "adult",
                            "price": 5000,
                            "capacity": 40,
                        }
                    ],
                }
            ],
            "merchandise": [
                {
                    "merchandise_id": str(test_merchandise.id),
                    "price_override": 1800,
                }
            ],
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Full Trip"
    assert data["mission_id"] == str(test_mission.id)


def test_create_trip_full_capacity_validation(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_boat: Boat,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=56)
    r = client.post(
        f"{TRIPS_URL}/create-full",
        headers=superuser_token_headers,
        json={
            "mission_id": str(test_mission.id),
            "name": "Bad Capacity Trip",
            "type": "launch_viewing",
            "departure_time": departure.isoformat(),
            "boats": [
                {
                    "boat_id": str(test_boat.id),
                    "max_capacity": 10,
                    "pricing": [
                        {
                            "ticket_type": "adult",
                            "price": 5000,
                            "capacity": 40,
                        }
                    ],
                }
            ],
        },
    )
    assert r.status_code == 400
    assert "capacity" in r.json()["detail"].lower()


def test_duplicate_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{TRIPS_URL}/{uuid.uuid4()}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_duplicate_trip_copies_boats_and_pricing(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_trip_boat_pricing: TripBoatPricing,
    test_merchandise,
    db: Session,
) -> None:
    db.add(
        TripMerchandise(
            trip_id=test_trip.id,
            merchandise_id=test_merchandise.id,
        )
    )
    db.commit()

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["id"] != str(test_trip.id)
    assert "(copy)" in (data.get("name") or "")


def test_reassign_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_boat: Boat,
) -> None:
    r = client.post(
        f"{TRIPS_URL}/{uuid.uuid4()}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(test_boat.id),
            "to_boat_id": str(test_boat.id),
            "type_mapping": {"adult": "adult"},
        },
    )
    assert r.status_code == 404


def test_reassign_boat_not_on_trip(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat: Boat,
    db: Session,
    test_provider,
) -> None:
    other_boat = Boat(
        name="Other Boat",
        slug="other-boat",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(other_boat)
    db.commit()
    db.refresh(other_boat)

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(other_boat.id),
            "to_boat_id": str(test_boat.id),
            "type_mapping": {"adult": "adult"},
        },
    )
    assert r.status_code == 400
    assert "assigned to this trip" in r.json()["detail"]


def test_reassign_no_passengers(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_boat: Boat,
    db: Session,
    test_provider,
) -> None:
    other_boat = Boat(
        name="Empty Target",
        slug="empty-target",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(other_boat)
    db.commit()
    db.refresh(other_boat)
    db.add(TripBoat(trip_id=test_trip.id, boat_id=other_boat.id))
    db.commit()

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(other_boat.id),
            "to_boat_id": str(test_boat.id),
            "type_mapping": {"adult": "adult"},
        },
    )
    assert r.status_code == 400
    assert "No passengers" in r.json()["detail"]


def test_reassign_missing_type_mapping(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat: Boat,
    test_trip_boat: TripBoat,
    test_booking_item: BookingItem,
    db: Session,
    test_provider,
) -> None:
    target_boat = Boat(
        name="Target Boat",
        slug="target-boat",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(target_boat)
    db.commit()
    db.refresh(target_boat)
    target_tb = TripBoat(trip_id=test_trip.id, boat_id=target_boat.id)
    db.add(target_tb)
    db.commit()
    db.refresh(target_tb)
    db.add(
        TripBoatPricing(
            trip_boat_id=target_tb.id,
            ticket_type="adult",
            price=5000,
            capacity=30,
        )
    )
    db.commit()

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(test_boat.id),
            "to_boat_id": str(target_boat.id),
            "type_mapping": {},
        },
    )
    assert r.status_code == 400
    assert "Type mapping required" in r.json()["detail"]


def test_reassign_invalid_target_ticket_type(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat: Boat,
    test_trip_boat: TripBoat,
    test_booking_item: BookingItem,
    db: Session,
    test_provider,
) -> None:
    target_boat = Boat(
        name="Limited Target",
        slug="limited-target",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(target_boat)
    db.commit()
    db.refresh(target_boat)
    db.add(TripBoat(trip_id=test_trip.id, boat_id=target_boat.id))
    db.commit()

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(test_boat.id),
            "to_boat_id": str(target_boat.id),
            "type_mapping": {"adult": "nonexistent_type"},
        },
    )
    assert r.status_code == 400
    assert "no capacity for ticket type" in r.json()["detail"]


def test_delete_trip_with_bookings_fails(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_booking_item: BookingItem,
) -> None:
    r = client.delete(
        f"{TRIPS_URL}/{test_trip.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["booking_count"] >= 1


def test_delete_trip_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_mission: Mission,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=70)
    trip = Trip(
        mission_id=test_mission.id,
        name="Deletable Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)

    r = client.delete(
        f"{TRIPS_URL}/{trip.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(trip.id)
    assert db.get(Trip, trip.id) is None


def test_delete_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.delete(
        f"{TRIPS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_trip_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.put(
        f"{TRIPS_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"name": "Ghost"},
    )
    assert r.status_code == 404


def test_update_trip_mission_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    r = client.put(
        f"{TRIPS_URL}/{test_trip.id}",
        headers=superuser_token_headers,
        json={"mission_id": str(uuid.uuid4())},
    )
    assert r.status_code == 404


def test_update_trip_departure_time(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
) -> None:
    new_departure = datetime.now(timezone.utc) + timedelta(days=80)
    r = client.put(
        f"{TRIPS_URL}/{test_trip.id}",
        headers=superuser_token_headers,
        json={"departure_time": new_departure.isoformat()},
    )
    assert r.status_code == 200
    assert r.json()["departure_time"] is not None


def test_read_trips_by_mission_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_trip: Trip,
) -> None:
    r = client.get(
        f"{TRIPS_URL}/mission/{test_mission.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert any(t["id"] == str(test_trip.id) for t in data["data"])
    assert data["data"][0]["timezone"] is not None


def test_reassign_target_capacity_exceeded(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: Trip,
    test_boat: Boat,
    test_trip_boat: TripBoat,
    test_booking_item: BookingItem,
    db: Session,
    test_provider,
) -> None:
    target_boat = Boat(
        name="Small Target",
        slug="small-target",
        capacity=40,
        provider_id=test_provider.id,
    )
    db.add(target_boat)
    db.commit()
    db.refresh(target_boat)
    target_tb = TripBoat(trip_id=test_trip.id, boat_id=target_boat.id, max_capacity=1)
    db.add(target_tb)
    db.commit()
    db.refresh(target_tb)
    db.add(
        TripBoatPricing(
            trip_boat_id=target_tb.id,
            ticket_type="adult",
            price=5000,
            capacity=1,
        )
    )
    db.commit()

    r = client.post(
        f"{TRIPS_URL}/{test_trip.id}/reassign-boat",
        headers=superuser_token_headers,
        json={
            "from_boat_id": str(test_boat.id),
            "to_boat_id": str(target_boat.id),
            "type_mapping": {"adult": "adult"},
        },
    )
    assert r.status_code == 400
    assert "capacity" in r.json()["detail"].lower()


def test_read_trips_by_mission_include_archived(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_mission: Mission,
    test_trip: Trip,
) -> None:
    test_trip.archived = True
    db.add(test_trip)
    db.commit()

    r = client.get(
        f"{TRIPS_URL}/mission/{test_mission.id}",
        headers=superuser_token_headers,
        params={"include_archived": "true"},
    )
    assert r.status_code == 200
    assert any(t["id"] == str(test_trip.id) for t in r.json()["data"])


def test_read_trips_by_mission_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{TRIPS_URL}/mission/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
