"""
Jurisdiction CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Jurisdiction, JurisdictionCreate, JurisdictionUpdate


def create_jurisdiction(
    *, session: Session, jurisdiction_in: JurisdictionCreate
) -> Jurisdiction:
    """Create a new jurisdiction."""
    db_obj = Jurisdiction.model_validate(jurisdiction_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID
) -> Jurisdiction | None:
    """Get a jurisdiction by ID."""
    return session.get(Jurisdiction, jurisdiction_id)


def get_jurisdictions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Jurisdiction]:
    """Get multiple jurisdictions."""
    return session.exec(select(Jurisdiction).offset(skip).limit(limit)).all()


def get_jurisdictions_by_location(
    *, session: Session, location_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Jurisdiction]:
    """Get jurisdictions by location."""
    return session.exec(
        select(Jurisdiction)
        .where(Jurisdiction.location_id == location_id)
        .offset(skip)
        .limit(limit)
    ).all()


def get_jurisdictions_count(*, session: Session) -> int:
    """Get the total count of jurisdictions."""
    count = session.exec(select(func.count(Jurisdiction.id))).first()
    return count or 0


def update_jurisdiction(
    *, session: Session, db_obj: Jurisdiction, obj_in: JurisdictionUpdate
) -> Jurisdiction:
    """Update a jurisdiction."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_jurisdiction(*, session: Session, db_obj: Jurisdiction) -> None:
    """Delete a jurisdiction."""
    session.delete(db_obj)
    session.commit()
