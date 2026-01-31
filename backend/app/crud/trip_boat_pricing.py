"""
TripBoatPricing CRUD operations.
"""

import uuid

from sqlmodel import Session, select

from app.models import TripBoatPricing, TripBoatPricingCreate, TripBoatPricingUpdate


def get_trip_boat_pricing(
    *, session: Session, trip_boat_pricing_id: uuid.UUID
) -> TripBoatPricing | None:
    """Get a trip boat pricing by ID."""
    return session.get(TripBoatPricing, trip_boat_pricing_id)


def get_trip_boat_pricing_by_trip_boat(
    *,
    session: Session,
    trip_boat_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[TripBoatPricing]:
    """Get trip boat pricing by trip_boat."""
    return session.exec(
        select(TripBoatPricing)
        .where(TripBoatPricing.trip_boat_id == trip_boat_id)
        .offset(skip)
        .limit(limit)
    ).all()


def create_trip_boat_pricing(
    *, session: Session, trip_boat_pricing_in: TripBoatPricingCreate
) -> TripBoatPricing:
    """Create a new trip boat pricing."""
    db_obj = TripBoatPricing.model_validate(trip_boat_pricing_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_trip_boat_pricing(
    *,
    session: Session,
    db_obj: TripBoatPricing,
    obj_in: TripBoatPricingUpdate,
) -> TripBoatPricing:
    """Update a trip boat pricing."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip_boat_pricing(
    *, session: Session, trip_boat_pricing_id: uuid.UUID
) -> TripBoatPricing | None:
    """Delete a trip boat pricing."""
    trip_boat_pricing = session.get(TripBoatPricing, trip_boat_pricing_id)
    if trip_boat_pricing:
        session.delete(trip_boat_pricing)
        session.commit()
    return trip_boat_pricing
