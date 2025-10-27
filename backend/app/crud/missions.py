"""
Mission CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import (
    Booking,
    BookingItem,
    Mission,
    MissionCreate,
    MissionUpdate,
    Trip,
)


def create_mission(*, session: Session, mission_in: MissionCreate) -> Mission:
    """Create a new mission."""
    db_obj = Mission.model_validate(mission_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_mission(*, session: Session, mission_id: uuid.UUID) -> Mission | None:
    """Get a mission by ID."""
    return session.get(Mission, mission_id)


def get_missions(*, session: Session, skip: int = 0, limit: int = 100) -> list[Mission]:
    """Get multiple missions."""
    return session.exec(select(Mission).offset(skip).limit(limit)).all()


def get_missions_by_launch(
    *, session: Session, launch_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Mission]:
    """Get missions by launch."""
    return session.exec(
        select(Mission).where(Mission.launch_id == launch_id).offset(skip).limit(limit)
    ).all()


def get_active_missions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Mission]:
    """Get active missions."""
    return session.exec(
        select(Mission).where(Mission.active).offset(skip).limit(limit)
    ).all()


def get_public_missions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Mission]:
    """Get public missions."""
    return session.exec(
        select(Mission).where(Mission.public).offset(skip).limit(limit)
    ).all()


def get_missions_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get missions without loading relationships.
    Returns dictionaries with mission data.
    """

    result = session.exec(
        text(
            """
            SELECT id, name, launch_id, active, public, sales_open_at, refund_cutoff_hours, created_at, updated_at
            FROM mission
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    missions_data = []
    for row in result:
        missions_data.append(
            {
                "id": row[0],  # id
                "name": row[1],  # name
                "launch_id": row[2],  # launch_id
                "active": row[3],  # active
                "public": row[4],  # public
                "sales_open_at": row[5],  # sales_open_at
                "refund_cutoff_hours": row[6],  # refund_cutoff_hours
                "created_at": row[7],  # created_at
                "updated_at": row[8],  # updated_at
            }
        )

    return missions_data


def get_missions_count(*, session: Session) -> int:
    """Get the total count of missions."""
    count = session.exec(select(func.count(Mission.id))).first()
    return count or 0


def get_missions_with_stats(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get a list of missions with booking statistics.
    Returns dictionaries with mission data plus total_bookings and total_sales.
    """

    # Get all missions using raw SQL to avoid relationship loading
    missions_result = session.exec(
        text(
            """
            SELECT id, name, launch_id, active, public, sales_open_at, refund_cutoff_hours, created_at, updated_at
            FROM mission
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    result = []
    for mission_row in missions_result:
        mission_id = mission_row[0]  # id
        mission_name = mission_row[1]  # name
        launch_id = mission_row[2]  # launch_id
        active = mission_row[3]  # active
        public = mission_row[4]  # public
        sales_open_at = mission_row[5]  # sales_open_at
        refund_cutoff_hours = mission_row[6]  # refund_cutoff_hours
        created_at = mission_row[7]  # created_at
        updated_at = mission_row[8]  # updated_at

        # Get all trips for this mission (just IDs to avoid relationship loading)
        trips_statement = select(Trip.id).where(Trip.mission_id == mission_id)
        trip_results = session.exec(trips_statement).unique().all()
        trip_ids = list(trip_results)

        # Calculate total bookings and sales for all trips in this mission
        if trip_ids:
            # Count unique bookings (not booking items) for this mission's trips
            # Only include confirmed, checked_in, and completed bookings (actual revenue)
            bookings_statement = (
                select(func.count(func.distinct(Booking.id)))
                .select_from(Booking)
                .join(BookingItem, Booking.id == BookingItem.booking_id)
                .where(BookingItem.trip_id.in_(trip_ids))
                .where(Booking.status.in_(["confirmed", "checked_in", "completed"]))
            )
            total_bookings = session.exec(bookings_statement).first() or 0

            # Sum total sales for this mission's trips
            # Only include confirmed, checked_in, and completed bookings (actual revenue)
            sales_statement = (
                select(func.sum(Booking.total_amount))
                .select_from(Booking)
                .join(BookingItem, Booking.id == BookingItem.booking_id)
                .where(BookingItem.trip_id.in_(trip_ids))
                .where(Booking.status.in_(["confirmed", "checked_in", "completed"]))
            )
            total_sales = session.exec(sales_statement).first() or 0.0
        else:
            total_bookings = 0
            total_sales = 0.0

        result.append(
            {
                "id": mission_id,
                "name": mission_name,
                "launch_id": launch_id,
                "active": active,
                "public": public,
                "sales_open_at": sales_open_at,
                "refund_cutoff_hours": refund_cutoff_hours,
                "created_at": created_at,
                "updated_at": updated_at,
                "total_bookings": total_bookings,
                "total_sales": float(total_sales),
            }
        )

    return result


def update_mission(
    *, session: Session, db_obj: Mission, obj_in: MissionUpdate
) -> Mission:
    """Update a mission."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_mission(*, session: Session, db_obj: Mission) -> None:
    """Delete a mission."""
    session.delete(db_obj)
    session.commit()
