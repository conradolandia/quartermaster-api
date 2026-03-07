"""
Tests for app.core.db init_db defaults.
"""

from datetime import timedelta

from sqlmodel import Session, select

from app.models import Launch, Mission, Trip


def test_init_db_creates_launch_viewing_trip_one_hour_before_launch(
    db: Session,
) -> None:
    launch = db.exec(select(Launch).where(Launch.name == "Default Launch")).first()
    mission = db.exec(select(Mission).where(Mission.name == "Default Mission")).first()

    assert launch is not None
    assert mission is not None

    trip = db.exec(
        select(Trip).where(
            Trip.mission_id == mission.id,
            Trip.type == "launch_viewing",
        )
    ).first()

    assert trip is not None
    assert trip.departure_time == launch.launch_timestamp - timedelta(hours=1)
    assert trip.boarding_time == trip.departure_time - timedelta(minutes=30)
    assert trip.check_in_time == trip.boarding_time - timedelta(minutes=30)
