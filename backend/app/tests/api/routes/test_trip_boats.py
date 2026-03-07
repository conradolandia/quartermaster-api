"""
Tests for trip-boats API routes.
"""

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
from app.tests.utils.utils import get_superuser_token_headers


def test_remaining_capacity_capped_when_per_type_capacities_exceed_boat_max(
    client: TestClient,
    db: Session,
) -> None:
    """
    When per-type capacities sum to more than boat effective_max (misconfiguration),
    remaining_capacity must be capped at effective_max to avoid negative seats taken.
    """
    # Create minimal chain: location -> jurisdiction -> provider -> launch -> mission -> trip
    location = Location(
        name="Test Launch Site",
        state="FL",
        timezone="America/New_York",
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    jurisdiction = Jurisdiction(
        name="Test County",
        sales_tax_rate=0.07,
        location_id=location.id,
    )
    db.add(jurisdiction)
    db.commit()
    db.refresh(jurisdiction)

    provider = Provider(
        name="Test Boat Tours",
        location="123 Marina Way",
        address="123 Marina Way, Port City, FL 32000",
        jurisdiction_id=jurisdiction.id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    future_date = datetime.now(timezone.utc) + timedelta(days=30)
    launch = Launch(
        name="Test Launch",
        launch_timestamp=future_date,
        summary="Test",
        location_id=location.id,
    )
    db.add(launch)
    db.commit()
    db.refresh(launch)

    mission = Mission(
        name="Test Mission",
        launch_id=launch.id,
        active=True,
        refund_cutoff_hours=24,
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    departure = datetime.now(timezone.utc) + timedelta(days=30, hours=-2)
    trip = Trip(
        mission_id=mission.id,
        name="Test Trip",
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

    # Boat with capacity 150; per-type capacities will sum to 200
    boat = Boat(
        name="Overbooked Boat",
        slug="overbooked-boat",
        capacity=150,
        provider_id=provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)

    trip_boat = TripBoat(
        trip_id=trip.id,
        boat_id=boat.id,
        max_capacity=None,
        use_only_trip_pricing=False,
    )
    db.add(trip_boat)
    db.commit()
    db.refresh(trip_boat)

    # Per-type capacities sum to 200 > 150 (misconfiguration)
    db.add(BoatPricing(boat_id=boat.id, ticket_type="upper", price=5000, capacity=100))
    db.add(BoatPricing(boat_id=boat.id, ticket_type="lower", price=5000, capacity=100))
    db.commit()

    headers = get_superuser_token_headers(client)
    r = client.get(
        f"{settings.API_V1_STR}/trip-boats/trip/{trip.id}",
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()

    assert len(data) == 1
    tb = data[0]
    max_cap = tb["max_capacity"]
    remaining = tb["remaining_capacity"]

    assert remaining <= max_cap, (
        f"remaining_capacity ({remaining}) must not exceed max_capacity ({max_cap}) "
        "to avoid negative seats taken"
    )
    used = max_cap - remaining
    assert used >= 0, "seats taken must not be negative"


def test_remaining_capacity_defaults_to_effective_max_when_no_pricing_exists(
    client: TestClient,
    db: Session,
) -> None:
    """
    When a trip boat has no effective pricing rows yet, it should not appear sold out.
    With zero bookings, remaining_capacity should default to effective_max.
    """
    location = Location(
        name="No Pricing Site",
        state="FL",
        timezone="America/New_York",
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    jurisdiction = Jurisdiction(
        name="No Pricing County",
        sales_tax_rate=0.07,
        location_id=location.id,
    )
    db.add(jurisdiction)
    db.commit()
    db.refresh(jurisdiction)

    provider = Provider(
        name="No Pricing Tours",
        location="123 Marina Way",
        address="123 Marina Way, Port City, FL 32000",
        jurisdiction_id=jurisdiction.id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    future_date = datetime.now(timezone.utc) + timedelta(days=30)
    launch = Launch(
        name="No Pricing Launch",
        launch_timestamp=future_date,
        summary="Test",
        location_id=location.id,
    )
    db.add(launch)
    db.commit()
    db.refresh(launch)

    mission = Mission(
        name="No Pricing Mission",
        launch_id=launch.id,
        active=True,
        refund_cutoff_hours=24,
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    departure = datetime.now(timezone.utc) + timedelta(days=30, hours=-2)
    trip = Trip(
        mission_id=mission.id,
        name="No Pricing Trip",
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

    boat = Boat(
        name="No Pricing Boat",
        slug="no-pricing-boat",
        capacity=10000,
        provider_id=provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)

    trip_boat = TripBoat(
        trip_id=trip.id,
        boat_id=boat.id,
        max_capacity=None,
        use_only_trip_pricing=False,
    )
    db.add(trip_boat)
    db.commit()
    db.refresh(trip_boat)

    headers = get_superuser_token_headers(client)
    r = client.get(
        f"{settings.API_V1_STR}/trip-boats/trip/{trip.id}",
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()

    assert len(data) == 1
    tb = data[0]
    assert tb["max_capacity"] == 10000
    assert tb["remaining_capacity"] == 10000
