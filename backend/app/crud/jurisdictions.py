"""
Jurisdiction CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models import (
    Jurisdiction,
    JurisdictionCreate,
    JurisdictionUpdate,
)


def create_jurisdiction(
    *, session: Session, jurisdiction_in: JurisdictionCreate
) -> Jurisdiction:
    """Create a new jurisdiction."""
    # Verify location exists
    from app.crud.locations import get_location

    location = get_location(session=session, location_id=jurisdiction_in.location_id)
    if not location:
        raise ValueError(f"Location with ID {jurisdiction_in.location_id} not found")

    db_obj = Jurisdiction.model_validate(jurisdiction_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    # Eager load location relationship for API serialization
    if db_obj.location_id:
        session.refresh(db_obj, ["location"])
    return db_obj


def get_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID
) -> Jurisdiction | None:
    """Get a jurisdiction by ID."""
    statement = (
        select(Jurisdiction)
        .where(Jurisdiction.id == jurisdiction_id)
        .options(selectinload(Jurisdiction.location))
    )
    jurisdiction = session.exec(statement).first()
    return jurisdiction


def get_jurisdictions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Jurisdiction]:
    """Get multiple jurisdictions."""
    statement = (
        select(Jurisdiction)
        .options(selectinload(Jurisdiction.location))
        .offset(skip)
        .limit(limit)
    )
    jurisdictions = session.exec(statement).all()
    return jurisdictions


def get_jurisdictions_by_location(
    *, session: Session, location_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Jurisdiction]:
    """Get jurisdictions by location."""
    statement = (
        select(Jurisdiction)
        .where(Jurisdiction.location_id == location_id)
        .options(selectinload(Jurisdiction.location))
        .offset(skip)
        .limit(limit)
    )
    jurisdictions = session.exec(statement).all()
    return jurisdictions


def get_jurisdictions_count(*, session: Session) -> int:
    """Get the total count of jurisdictions."""
    count = session.exec(select(func.count(Jurisdiction.id))).first()
    return count or 0


def update_jurisdiction(
    *, session: Session, db_obj: Jurisdiction, obj_in: JurisdictionUpdate
) -> Jurisdiction:
    """Update a jurisdiction."""
    from app.crud.locations import get_location

    obj_data = obj_in.model_dump(exclude_unset=True)

    # If location_id is being updated, verify the new location exists
    if "location_id" in obj_data and obj_data["location_id"] != db_obj.location_id:
        location = get_location(session=session, location_id=obj_data["location_id"])
        if not location:
            raise ValueError(f"Location with ID {obj_data['location_id']} not found")

    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj, ["location"])
    return db_obj


def delete_jurisdiction(*, session: Session, db_obj: Jurisdiction) -> None:
    """Delete a jurisdiction."""
    session.delete(db_obj)
    session.commit()
