"""
Merchandise (catalog) CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import (
    Merchandise,
    MerchandiseCreate,
    MerchandiseUpdate,
    MerchandiseVariationCreate,
)


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
    """Create a new merchandise and one variation row (no variant). Add more via variations API."""
    db_obj = Merchandise.model_validate(merchandise_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    var_in = MerchandiseVariationCreate(
        merchandise_id=db_obj.id,
        variant_value="",
        quantity_total=db_obj.quantity_available or 0,
        quantity_sold=0,
        quantity_fulfilled=0,
    )
    from app.crud.merchandise_variation import create_merchandise_variation

    create_merchandise_variation(session=session, variation_in=var_in)
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
    from app.models import BookingItem, MerchandiseVariation, TripMerchandise

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
    # Check if any variation is referenced by booking items
    booking_ref = (
        session.exec(
            select(func.count(BookingItem.id))
            .select_from(BookingItem)
            .join(
                MerchandiseVariation,
                BookingItem.merchandise_variation_id == MerchandiseVariation.id,
            )
            .where(MerchandiseVariation.merchandise_id == merchandise_id)
        ).first()
        or 0
    )
    if booking_ref > 0:
        raise ValueError(
            "Cannot delete merchandise: one or more variations are referenced by booking items. Resolve those bookings first."
        )
    # Delete variations first (no FK from bookingitem blocks after the check above)
    for var in session.exec(
        select(MerchandiseVariation).where(
            MerchandiseVariation.merchandise_id == merchandise_id
        )
    ).all():
        session.delete(var)
    session.delete(merchandise)
    session.commit()
    return merchandise
