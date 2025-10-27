"""
TripMerchandise CRUD operations.
"""

import uuid

from sqlmodel import Session, select

from app.models import TripMerchandise, TripMerchandiseCreate, TripMerchandiseUpdate


def get_trip_merchandise(
    *, session: Session, trip_merchandise_id: uuid.UUID
) -> TripMerchandise | None:
    """Get a trip merchandise by ID."""
    return session.get(TripMerchandise, trip_merchandise_id)


def get_trip_merchandise_by_trip(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripMerchandise]:
    """Get trip merchandise by trip."""
    return session.exec(
        select(TripMerchandise)
        .where(TripMerchandise.trip_id == trip_id)
        .offset(skip)
        .limit(limit)
    ).all()


def create_trip_merchandise(
    *, session: Session, trip_merchandise_in: TripMerchandiseCreate
) -> TripMerchandise:
    """Create a new trip merchandise."""
    db_obj = TripMerchandise.model_validate(trip_merchandise_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_trip_merchandise(
    *, session: Session, db_obj: TripMerchandise, obj_in: TripMerchandiseUpdate
) -> TripMerchandise:
    """Update a trip merchandise."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip_merchandise(
    *, session: Session, trip_merchandise_id: uuid.UUID
) -> TripMerchandise:
    """Delete a trip merchandise."""
    trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
    if trip_merchandise:
        session.delete(trip_merchandise)
        session.commit()
    return trip_merchandise
