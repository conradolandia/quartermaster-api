"""
Tests for app.crud.trips module.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.crud.trips import (
    apply_sales_open_bump_if_needed,
    create_trip,
    delete_trip,
    get_trip,
    get_trips,
    get_trips_by_mission,
    get_trips_count,
    update_trip,
)
from app.models import (
    Mission,
    Trip,
    TripBase,
    TripUpdate,
)


class TestGetTrip:
    """Tests for get_trip function."""

    def test_returns_trip_when_exists(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        result = get_trip(session=db, trip_id=test_trip.id)
        assert result is not None
        assert result.id == test_trip.id
        assert result.name == test_trip.name

    def test_returns_none_when_not_exists(
        self,
        db: Session,
    ) -> None:
        result = get_trip(session=db, trip_id=uuid.uuid4())
        assert result is None


class TestGetTrips:
    """Tests for get_trips function."""

    def test_returns_trips(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        result = get_trips(session=db)
        assert len(result) >= 1
        trip_ids = [t.id for t in result]
        assert test_trip.id in trip_ids

    def test_respects_skip_limit(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        departure = datetime.now(timezone.utc) + timedelta(days=30)
        for i in range(5):
            trip = Trip(
                mission_id=test_mission.id,
                name=f"Trip {i}",
                type="launch_viewing",
                active=True,
                booking_mode="public",
                check_in_time=departure - timedelta(hours=1),
                boarding_time=departure - timedelta(minutes=30),
                departure_time=departure,
            )
            db.add(trip)
        db.commit()

        result = get_trips(session=db, skip=0, limit=3)
        assert len(result) == 3

        result_skip = get_trips(session=db, skip=2, limit=3)
        assert len(result_skip) == 3


class TestGetTripsCount:
    """Tests for get_trips_count function."""

    def test_returns_count(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        result = get_trips_count(session=db)
        assert result >= 1


class TestGetTripsByMission:
    """Tests for get_trips_by_mission function."""

    def test_returns_trips_for_mission(
        self,
        db: Session,
        test_mission: Mission,
        test_trip: Trip,
    ) -> None:
        result = get_trips_by_mission(session=db, mission_id=test_mission.id)
        assert len(result) == 1
        assert result[0].id == test_trip.id

    def test_returns_empty_for_unknown_mission(
        self,
        db: Session,
    ) -> None:
        result = get_trips_by_mission(session=db, mission_id=uuid.uuid4())
        assert result == []


class TestCreateTrip:
    """Tests for create_trip function."""

    def test_creates_trip(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        departure = datetime.now(timezone.utc) + timedelta(days=30)
        trip_in = TripBase(
            mission_id=test_mission.id,
            name="New Trip",
            type="launch_viewing",
            active=True,
            booking_mode="public",
            check_in_time=departure - timedelta(hours=1),
            boarding_time=departure - timedelta(minutes=30),
            departure_time=departure,
        )

        result = create_trip(session=db, trip_in=trip_in)

        assert result.id is not None
        assert result.name == "New Trip"
        assert result.mission_id == test_mission.id

    def test_created_trip_has_timestamps(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        departure = datetime.now(timezone.utc) + timedelta(days=30)
        trip_in = TripBase(
            mission_id=test_mission.id,
            name="Timestamped Trip",
            type="launch_viewing",
            check_in_time=departure - timedelta(hours=1),
            boarding_time=departure - timedelta(minutes=30),
            departure_time=departure,
        )

        result = create_trip(session=db, trip_in=trip_in)

        assert result.created_at is not None
        assert result.updated_at is not None


class TestUpdateTrip:
    """Tests for update_trip function."""

    def test_updates_trip_name(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        update_data = TripUpdate(name="Updated Trip Name")
        result = update_trip(session=db, db_obj=test_trip, obj_in=update_data)

        assert result.name == "Updated Trip Name"

    def test_updates_trip_with_dict(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        update_data = {"name": "Dict Updated Name", "active": False}
        result = update_trip(session=db, db_obj=test_trip, obj_in=update_data)

        assert result.name == "Dict Updated Name"
        assert result.active is False

    def test_partial_update(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        original_type = test_trip.type
        update_data = TripUpdate(booking_mode="early_bird")
        result = update_trip(session=db, db_obj=test_trip, obj_in=update_data)

        assert result.booking_mode == "early_bird"
        assert result.type == original_type


class TestApplySalesOpenBumpIfNeeded:
    """Tests for apply_sales_open_bump_if_needed: persist bump when now >= sales_open_at."""

    def test_after_sales_open_persists_bump_and_clears_sales_open(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        sales_open = datetime(2025, 6, 10, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        departure = now + timedelta(days=7)
        trip = Trip(
            mission_id=test_mission.id,
            name="Bump test",
            type="launch_viewing",
            booking_mode="private",
            sales_open_at=sales_open,
            check_in_time=departure - timedelta(hours=1),
            boarding_time=departure - timedelta(minutes=30),
            departure_time=departure,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        result = apply_sales_open_bump_if_needed(
            session=db,
            trip_id=trip.id,
            booking_mode=trip.booking_mode,
            sales_open_at=trip.sales_open_at,
            now=now,
        )

        assert result == "early_bird"
        db.refresh(trip)
        assert trip.booking_mode == "early_bird"
        assert trip.sales_open_at is None

    def test_before_sales_open_does_not_persist(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        sales_open = datetime(2025, 6, 20, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        departure = now + timedelta(days=30)
        trip = Trip(
            mission_id=test_mission.id,
            name="No bump test",
            type="launch_viewing",
            booking_mode="private",
            sales_open_at=sales_open,
            check_in_time=departure - timedelta(hours=1),
            boarding_time=departure - timedelta(minutes=30),
            departure_time=departure,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        result = apply_sales_open_bump_if_needed(
            session=db,
            trip_id=trip.id,
            booking_mode=trip.booking_mode,
            sales_open_at=trip.sales_open_at,
            now=now,
        )

        assert result == "private"
        db.refresh(trip)
        assert trip.booking_mode == "private"
        assert trip.sales_open_at == sales_open

    def test_updates_trip_dict_when_bumped(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        sales_open = datetime(2025, 6, 10, tzinfo=timezone.utc)
        now = datetime(2025, 6, 15, tzinfo=timezone.utc)
        departure = now + timedelta(days=7)
        trip = Trip(
            mission_id=test_mission.id,
            name="Dict bump test",
            type="launch_viewing",
            booking_mode="early_bird",
            sales_open_at=sales_open,
            check_in_time=departure - timedelta(hours=1),
            boarding_time=departure - timedelta(minutes=30),
            departure_time=departure,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        trip_dict = {"booking_mode": "early_bird", "sales_open_at": sales_open}
        result = apply_sales_open_bump_if_needed(
            session=db,
            trip_id=trip.id,
            booking_mode=trip.booking_mode,
            sales_open_at=trip.sales_open_at,
            now=now,
            trip_dict_to_update=trip_dict,
        )

        assert result == "public"
        assert trip_dict["booking_mode"] == "public"
        assert trip_dict["sales_open_at"] is None


class TestDeleteTrip:
    """Tests for delete_trip function."""

    def test_deletes_trip(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        departure = datetime.now(timezone.utc) + timedelta(days=30)
        trip = Trip(
            mission_id=test_mission.id,
            name="To Delete",
            type="launch_viewing",
            check_in_time=departure - timedelta(hours=1),
            boarding_time=departure - timedelta(minutes=30),
            departure_time=departure,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        trip_id = trip.id

        result = delete_trip(session=db, trip_id=trip_id)

        assert result is not None
        assert result.id == trip_id

        deleted = get_trip(session=db, trip_id=trip_id)
        assert deleted is None

    def test_returns_none_for_nonexistent_trip(
        self,
        db: Session,
    ) -> None:
        result = delete_trip(session=db, trip_id=uuid.uuid4())
        assert result is None
