"""
Launch CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select, text

from app.models import Launch, LaunchCreate, LaunchUpdate


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


def get_launches(*, session: Session, skip: int = 0, limit: int = 100) -> list[Launch]:
    """Get multiple launches."""
    return session.exec(select(Launch).offset(skip).limit(limit)).all()


def get_launches_by_location(
    *, session: Session, location_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Launch]:
    """Get launches by location."""
    return session.exec(
        select(Launch)
        .where(Launch.location_id == location_id)
        .offset(skip)
        .limit(limit)
    ).all()


def get_launches_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get launches without loading relationships.
    Returns dictionaries with launch data.
    """

    result = session.exec(
        text(
            """
            SELECT l.id, l.name, l.summary, l.launch_timestamp, l.location_id,
                   l.created_at, l.updated_at, loc.timezone
            FROM launch l
            JOIN location loc ON l.location_id = loc.id
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
                "created_at": row[5],
                "updated_at": row[6],
                "timezone": row[7] or "UTC",
            }
        )

    return launches_data


def get_launches_count(*, session: Session) -> int:
    """Get the total count of launches."""
    count = session.exec(select(func.count(Launch.id))).first()
    return count or 0


def update_launch(*, session: Session, db_obj: Launch, obj_in: LaunchUpdate) -> Launch:
    """Update a launch."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_launch(*, session: Session, db_obj: Launch) -> None:
    """Delete a launch."""
    session.delete(db_obj)
    session.commit()
