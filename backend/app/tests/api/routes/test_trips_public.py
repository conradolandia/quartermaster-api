"""Tests for public trip listing and detail endpoints."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    BoatPricing,
    Jurisdiction,
    Launch,
    Location,
    Mission,
    Provider,
    Trip,
    TripBoat,
)

# -- GET /trips/public/ -------------------------------------------------------


def test_list_public_trips(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.get(f"{settings.API_V1_STR}/trips/public/")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) >= 1
    trip_ids = [t["id"] for t in data]
    assert str(test_trip.id) in trip_ids


def test_list_public_trips_with_type_filter(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/trips/public/",
        params={"trip_type": "launch_viewing"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert all(t.get("type") == "launch_viewing" for t in data)


def test_list_public_trips_excludes_inactive(
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=30, hours=-2)
    inactive_trip = Trip(
        mission_id=test_mission.id,
        name="Inactive Trip",
        type="launch_viewing",
        active=False,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(inactive_trip)
    db.commit()
    db.refresh(inactive_trip)

    r = client.get(f"{settings.API_V1_STR}/trips/public/")
    assert r.status_code == 200
    trip_ids = [t["id"] for t in r.json()["data"]]
    assert str(inactive_trip.id) not in trip_ids


def test_list_public_trips_excludes_private(
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    departure = datetime.now(timezone.utc) + timedelta(days=30, hours=-2)
    private_trip = Trip(
        mission_id=test_mission.id,
        name="Private Trip",
        type="launch_viewing",
        active=True,
        booking_mode="private",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(private_trip)
    db.commit()
    db.refresh(private_trip)

    r = client.get(f"{settings.API_V1_STR}/trips/public/")
    assert r.status_code == 200
    trip_ids = [t["id"] for t in r.json()["data"]]
    assert str(private_trip.id) not in trip_ids


# -- GET /trips/public/{trip_id} -----------------------------------------------


def test_get_public_trip(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_trip_boat: TripBoat,
    test_boat_pricing: BoatPricing,
) -> None:
    r = client.get(f"{settings.API_V1_STR}/trips/public/{test_trip.id}")
    assert r.status_code == 200
    assert r.json()["id"] == str(test_trip.id)


def test_get_public_trip_not_found(
    client: TestClient,
    db: Session,
) -> None:
    random_id = uuid.uuid4()
    r = client.get(f"{settings.API_V1_STR}/trips/public/{random_id}")
    assert r.status_code == 404


def test_get_public_trip_private_requires_code(
    client: TestClient,
    db: Session,
    test_location: Location,
    test_jurisdiction: Jurisdiction,
    test_provider: Provider,
) -> None:
    future_date = datetime.now(timezone.utc) + timedelta(days=60)
    launch = Launch(
        name="Private Launch",
        launch_timestamp=future_date,
        summary="Private test",
        location_id=test_location.id,
    )
    db.add(launch)
    db.commit()
    db.refresh(launch)

    mission = Mission(
        name="Private Mission",
        launch_id=launch.id,
        active=True,
        refund_cutoff_hours=24,
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    departure = datetime.now(timezone.utc) + timedelta(days=60, hours=-2)
    private_trip = Trip(
        mission_id=mission.id,
        name="Private Only Trip",
        type="launch_viewing",
        active=True,
        booking_mode="private",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(private_trip)
    db.commit()
    db.refresh(private_trip)

    boat = Boat(
        name="Private Boat",
        slug="private-boat",
        capacity=50,
        provider_id=test_provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)

    db.add(
        TripBoat(
            trip_id=private_trip.id,
            boat_id=boat.id,
            max_capacity=None,
            use_only_trip_pricing=False,
        )
    )
    db.add(
        BoatPricing(
            boat_id=boat.id,
            ticket_type="adult",
            price=5000,
            capacity=40,
        )
    )
    db.commit()

    r = client.get(f"{settings.API_V1_STR}/trips/public/{private_trip.id}")
    assert r.status_code == 403
