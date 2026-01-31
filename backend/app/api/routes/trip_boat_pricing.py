"""
TripBoatPricing API routes.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    Boat,
    TripBoat,
    TripBoatPricing,
    TripBoatPricingCreate,
    TripBoatPricingPublic,
    TripBoatPricingUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trip-boat-pricing", tags=["trip-boat-pricing"])


@router.post(
    "/",
    response_model=TripBoatPricingPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_pricing_in: TripBoatPricingCreate,
) -> TripBoatPricingPublic:
    """Create trip boat pricing (per-trip, per-boat price override)."""
    # Reject duplicate (trip_boat_id, ticket_type)
    existing = session.exec(
        select(TripBoatPricing).where(
            TripBoatPricing.trip_boat_id == trip_boat_pricing_in.trip_boat_id,
            TripBoatPricing.ticket_type == trip_boat_pricing_in.ticket_type,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pricing for ticket type '{trip_boat_pricing_in.ticket_type}' "
                "already exists for this trip/boat"
            ),
        )
    trip_boat = session.get(TripBoat, trip_boat_pricing_in.trip_boat_id)
    if not trip_boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip boat not found",
        )
    obj = crud.create_trip_boat_pricing(
        session=session, trip_boat_pricing_in=trip_boat_pricing_in
    )
    session.refresh(trip_boat)
    boat = session.get(Boat, trip_boat.boat_id)
    effective_max = (
        trip_boat.max_capacity
        if trip_boat.max_capacity is not None
        else (boat.capacity if boat else 0)
    )
    capacities = crud.get_effective_capacity_per_ticket_type(
        session=session, trip_id=trip_boat.trip_id, boat_id=trip_boat.boat_id
    )
    if sum(capacities.values()) > effective_max:
        crud.delete_trip_boat_pricing(session=session, trip_boat_pricing_id=obj.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Sum of ticket-type capacities ({sum(capacities.values())}) would exceed "
                f"trip/boat max capacity ({effective_max})"
            ),
        )
    return TripBoatPricingPublic.model_validate(obj)


@router.get(
    "/",
    response_model=list[TripBoatPricingPublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_trip_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_id: uuid.UUID | None = None,
) -> list[TripBoatPricingPublic]:
    """List trip boat pricing, optionally by trip_boat_id."""
    if trip_boat_id is None:
        return []
    rows = crud.get_trip_boat_pricing_by_trip_boat(
        session=session, trip_boat_id=trip_boat_id
    )
    return [TripBoatPricingPublic.model_validate(r) for r in rows]


@router.get(
    "/{trip_boat_pricing_id}",
    response_model=TripBoatPricingPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_trip_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_pricing_id: uuid.UUID,
) -> TripBoatPricingPublic:
    """Get trip boat pricing by ID."""
    obj = crud.get_trip_boat_pricing(
        session=session, trip_boat_pricing_id=trip_boat_pricing_id
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip boat pricing not found",
        )
    return TripBoatPricingPublic.model_validate(obj)


@router.put(
    "/{trip_boat_pricing_id}",
    response_model=TripBoatPricingPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_trip_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_pricing_id: uuid.UUID,
    trip_boat_pricing_in: TripBoatPricingUpdate,
) -> TripBoatPricingPublic:
    """Update trip boat pricing."""
    obj = crud.get_trip_boat_pricing(
        session=session, trip_boat_pricing_id=trip_boat_pricing_id
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip boat pricing not found",
        )
    if (
        trip_boat_pricing_in.ticket_type is not None
        and trip_boat_pricing_in.ticket_type != obj.ticket_type
    ):
        existing = session.exec(
            select(TripBoatPricing).where(
                TripBoatPricing.trip_boat_id == obj.trip_boat_id,
                TripBoatPricing.ticket_type == trip_boat_pricing_in.ticket_type,
                TripBoatPricing.id != trip_boat_pricing_id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Pricing for ticket type '{trip_boat_pricing_in.ticket_type}' "
                    "already exists for this trip/boat"
                ),
            )
    trip_boat = obj.trip_boat
    boat = session.get(Boat, trip_boat.boat_id)
    effective_max = (
        trip_boat.max_capacity
        if trip_boat.max_capacity is not None
        else (boat.capacity if boat else 0)
    )
    boat_pricing = crud.get_boat_pricing_by_boat(
        session=session, boat_id=trip_boat.boat_id
    )
    tbp_list = crud.get_trip_boat_pricing_by_trip_boat(
        session=session, trip_boat_id=obj.trip_boat_id
    )
    by_boat = {bp.ticket_type: bp.capacity for bp in boat_pricing}
    by_trip: dict[str, int] = {}
    for tbp in tbp_list:
        if tbp.id == trip_boat_pricing_id:
            key = trip_boat_pricing_in.ticket_type or tbp.ticket_type
            val = (
                trip_boat_pricing_in.capacity
                if trip_boat_pricing_in.capacity is not None
                else tbp.capacity
            )
        else:
            key = tbp.ticket_type
            val = (
                tbp.capacity
                if tbp.capacity is not None
                else by_boat.get(tbp.ticket_type)
            )
        if val is not None:
            by_trip[key] = val
    all_types = set(by_boat) | set(by_trip)
    total = sum(
        by_trip.get(t) or by_boat.get(t) or 0
        for t in all_types
        if (by_trip.get(t) or by_boat.get(t)) is not None
    )
    if total > effective_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Sum of ticket-type capacities ({total}) would exceed "
                f"trip/boat max capacity ({effective_max})"
            ),
        )
    obj = crud.update_trip_boat_pricing(
        session=session, db_obj=obj, obj_in=trip_boat_pricing_in
    )
    return TripBoatPricingPublic.model_validate(obj)


@router.delete(
    "/{trip_boat_pricing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_trip_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_pricing_id: uuid.UUID,
) -> None:
    """Delete trip boat pricing."""
    obj = crud.get_trip_boat_pricing(
        session=session, trip_boat_pricing_id=trip_boat_pricing_id
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip boat pricing not found",
        )
    crud.delete_trip_boat_pricing(
        session=session, trip_boat_pricing_id=trip_boat_pricing_id
    )
