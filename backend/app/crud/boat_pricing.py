"""
BoatPricing CRUD operations.
"""

import uuid

from sqlmodel import Session, select

from app.models import BoatPricing, BoatPricingCreate, BoatPricingUpdate


def get_boat_pricing(
    *, session: Session, boat_pricing_id: uuid.UUID
) -> BoatPricing | None:
    """Get a boat pricing by ID."""
    return session.get(BoatPricing, boat_pricing_id)


def get_boat_pricing_by_boat(
    *, session: Session, boat_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[BoatPricing]:
    """Get boat pricing by boat."""
    return session.exec(
        select(BoatPricing)
        .where(BoatPricing.boat_id == boat_id)
        .offset(skip)
        .limit(limit)
    ).all()


def create_boat_pricing(
    *, session: Session, boat_pricing_in: BoatPricingCreate
) -> BoatPricing:
    """Create a new boat pricing."""
    db_obj = BoatPricing.model_validate(boat_pricing_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_boat_pricing(
    *, session: Session, db_obj: BoatPricing, obj_in: BoatPricingUpdate
) -> BoatPricing:
    """Update a boat pricing."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_boat_pricing(
    *, session: Session, boat_pricing_id: uuid.UUID
) -> BoatPricing | None:
    """Delete a boat pricing."""
    boat_pricing = session.get(BoatPricing, boat_pricing_id)
    if boat_pricing:
        session.delete(boat_pricing)
        session.commit()
    return boat_pricing
