"""
Merchandise (catalog) CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Merchandise, MerchandiseCreate, MerchandiseUpdate


def get_merchandise(
    *, session: Session, merchandise_id: uuid.UUID
) -> Merchandise | None:
    """Get a merchandise by ID."""
    return session.get(Merchandise, merchandise_id)


def get_merchandise_list(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Merchandise]:
    """Get merchandise list with pagination."""
    return session.exec(
        select(Merchandise).order_by(Merchandise.name).offset(skip).limit(limit)
    ).all()


def get_merchandise_count(*, session: Session) -> int:
    """Get total merchandise count."""
    result = session.exec(select(func.count(Merchandise.id))).first()
    return result or 0


def create_merchandise(
    *, session: Session, merchandise_in: MerchandiseCreate
) -> Merchandise:
    """Create a new merchandise."""
    db_obj = Merchandise.model_validate(merchandise_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_merchandise(
    *, session: Session, db_obj: Merchandise, obj_in: MerchandiseUpdate
) -> Merchandise:
    """Update a merchandise."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_merchandise(
    *, session: Session, merchandise_id: uuid.UUID
) -> Merchandise | None:
    """Delete a merchandise. Returns None if not found."""
    from app.models import TripMerchandise

    merchandise = session.get(Merchandise, merchandise_id)
    if not merchandise:
        return None
    # Check if any trip still references this merchandise
    ref = session.exec(
        select(TripMerchandise).where(TripMerchandise.merchandise_id == merchandise_id)
    ).first()
    if ref:
        raise ValueError(
            "Cannot delete merchandise: it is still offered on one or more trips"
        )
    session.delete(merchandise)
    session.commit()
    return merchandise
