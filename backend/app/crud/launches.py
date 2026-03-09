"""
Launch CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import Launch, LaunchCreate, LaunchUpdate, Mission, Trip


def create_launch(*, session: Session, launch_in: LaunchCreate) -> Launch:
    """Create a new launch."""
    db_obj = Launch.model_validate(launch_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_launch(*, session: Session, launch_id: uuid.UUID) -> Launch | None:
    """Get a launch by ID."""
    return session.get(Launch, launch_id)


def get_launches(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> list[Launch]:
    """Get multiple launches. By default exclude archived."""
    stmt = select(Launch).offset(skip).limit(limit)
    if not include_archived:
        stmt = stmt.where(Launch.archived == False)  # noqa: E712
    return session.exec(stmt).all()


def get_launches_by_location(
    *,
    session: Session,
    location_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> list[Launch]:
    """Get launches by location. By default exclude archived."""
    stmt = (
        select(Launch)
        .where(Launch.location_id == location_id)
        .offset(skip)
        .limit(limit)
    )
    if not include_archived:
        stmt = stmt.where(Launch.archived == False)  # noqa: E712
    return session.exec(stmt).all()


def get_launches_no_relationships(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> list[dict]:
    """
    Get launches without loading relationships.
    Returns dictionaries with launch data. By default exclude archived.
    """
    where_clause = "" if include_archived else "WHERE l.archived = false"
    result = session.exec(
        text(
            f"""
            SELECT l.id, l.name, l.summary, l.launch_timestamp, l.location_id,
                   l.archived, l.created_at, l.updated_at, loc.timezone
            FROM launch l
            JOIN location loc ON l.location_id = loc.id
            {where_clause}
            ORDER BY l.created_at DESC
            LIMIT :limit OFFSET :skip
        """
        ).params(limit=limit, skip=skip)
    ).all()

    launches_data = []
    for row in result:
        launches_data.append(
            {
                "id": row[0],
                "name": row[1],
                "summary": row[2],
                "launch_timestamp": row[3],
                "location_id": row[4],
                "archived": row[5],
                "created_at": row[6],
                "updated_at": row[7],
                "timezone": row[8] or "UTC",
            }
        )

    return launches_data


def get_launches_count(*, session: Session, include_archived: bool = False) -> int:
    """Get the total count of launches. By default exclude archived."""
    stmt = select(func.count(Launch.id))
    if not include_archived:
        stmt = stmt.where(Launch.archived == False)  # noqa: E712
    count = session.exec(stmt).first()
    return count or 0


def update_launch(*, session: Session, db_obj: Launch, obj_in: LaunchUpdate) -> Launch:
    """Update a launch."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def archive_launch_cascade(*, session: Session, launch_id: uuid.UUID) -> None:
    """Set launch, all its missions, and all their trips to archived. Call after update_launch(archived=True)."""
    launch = session.get(Launch, launch_id)
    if launch:
        launch.archived = True
        session.add(launch)
    mission_ids = [
        row[0]
        for row in session.exec(
            select(Mission.id).where(Mission.launch_id == launch_id)
        ).all()
    ]
    for mission in session.exec(select(Mission).where(Mission.launch_id == launch_id)):
        mission.archived = True
        session.add(mission)
    for mission_id in mission_ids:
        for trip in session.exec(select(Trip).where(Trip.mission_id == mission_id)):
            trip.archived = True
            session.add(trip)
    session.commit()


def delete_launch(*, session: Session, db_obj: Launch) -> None:
    """Delete a launch. Fails if any missions reference it."""
    missions_count = (
        session.exec(
            select(func.count(Mission.id)).where(Mission.launch_id == db_obj.id)
        ).first()
        or 0
    )
    if missions_count > 0:
        raise ValueError(
            f"Cannot delete this launch: {missions_count} mission(s) are associated. Remove those missions first."
        )
    session.delete(db_obj)
    session.commit()
