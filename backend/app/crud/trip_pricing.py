"""
TripPricing CRUD operations.
"""

import uuid

from sqlmodel import Session, select

from app.models import TripPricing, TripPricingCreate, TripPricingUpdate


def get_trip_pricing(
    *, session: Session, trip_pricing_id: uuid.UUID
) -> TripPricing | None:
    """Get a trip pricing by ID."""
    return session.get(TripPricing, trip_pricing_id)


def get_trip_pricing_by_trip(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripPricing]:
    """Get trip pricing by trip."""
    return session.exec(
        select(TripPricing)
        .where(TripPricing.trip_id == trip_id)
        .offset(skip)
        .limit(limit)
    ).all()


def create_trip_pricing(
    *, session: Session, trip_pricing_in: TripPricingCreate
) -> TripPricing:
    """Create a new trip pricing."""
    db_obj = TripPricing.model_validate(trip_pricing_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_trip_pricing(
    *, session: Session, db_obj: TripPricing, obj_in: TripPricingUpdate
) -> TripPricing:
    """Update a trip pricing."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip_pricing(*, session: Session, trip_pricing_id: uuid.UUID) -> TripPricing:
    """Delete a trip pricing."""
    trip_pricing = session.get(TripPricing, trip_pricing_id)
    if trip_pricing:
        session.delete(trip_pricing)
        session.commit()
    return trip_pricing
