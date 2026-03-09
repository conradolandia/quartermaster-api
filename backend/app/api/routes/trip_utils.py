"""Shared helpers for trip routes (admin, public, operations)."""

from sqlmodel import Session

from app import crud
from app.models import Trip, TripPublic


def trip_to_public(session: Session, trip: Trip) -> TripPublic:
    """Build TripPublic with timezone and effective_booking_mode."""
    crud.apply_sales_open_bump_if_needed(
        session=session,
        trip_id=trip.id,
        booking_mode=trip.booking_mode,
        sales_open_at=trip.sales_open_at,
    )
    mission = crud.get_mission(session=session, mission_id=trip.mission_id)
    tz = "UTC"
    if mission:
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        if launch:
            location = crud.get_location(
                session=session, location_id=launch.location_id
            )
            if location:
                tz = location.timezone
    data = trip.model_dump(mode="json", exclude={"mission"})
    data.setdefault("trip_boats", [])
    data["effective_booking_mode"] = trip.booking_mode
    return TripPublic(**data, timezone=tz)
