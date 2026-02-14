"""
BoatPricing API routes (boat-level default ticket types and prices).
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
    BoatPricing,
    BoatPricingCreate,
    BoatPricingPublic,
    BoatPricingUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/boat-pricing", tags=["boat-pricing"])


@router.post(
    "/",
    response_model=BoatPricingPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    boat_pricing_in: BoatPricingCreate,
) -> BoatPricingPublic:
    """Create boat pricing (boat-level default ticket type and price)."""
    existing = session.exec(
        select(BoatPricing).where(
            BoatPricing.boat_id == boat_pricing_in.boat_id,
            BoatPricing.ticket_type == boat_pricing_in.ticket_type,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Pricing for ticket type '{boat_pricing_in.ticket_type}' "
                "already exists for this boat"
            ),
        )
    boat = session.get(Boat, boat_pricing_in.boat_id)
    if not boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boat not found",
        )
    existing_rows = crud.get_boat_pricing_by_boat(
        session=session, boat_id=boat_pricing_in.boat_id
    )
    total_capacity = sum(bp.capacity for bp in existing_rows) + boat_pricing_in.capacity
    if total_capacity > boat.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Sum of ticket-type capacities ({total_capacity}) would exceed "
                f"boat capacity ({boat.capacity})"
            ),
        )
    obj = crud.create_boat_pricing(session=session, boat_pricing_in=boat_pricing_in)
    return BoatPricingPublic.model_validate(obj)


@router.get(
    "/",
    response_model=list[BoatPricingPublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    boat_id: uuid.UUID | None = None,
) -> list[BoatPricingPublic]:
    """List boat pricing, optionally by boat_id."""
    if boat_id is None:
        return []
    rows = crud.get_boat_pricing_by_boat(session=session, boat_id=boat_id)
    return [BoatPricingPublic.model_validate(r) for r in rows]


@router.get(
    "/{boat_pricing_id}",
    response_model=BoatPricingPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    boat_pricing_id: uuid.UUID,
) -> BoatPricingPublic:
    """Get boat pricing by ID."""
    obj = crud.get_boat_pricing(session=session, boat_pricing_id=boat_pricing_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boat pricing not found",
        )
    return BoatPricingPublic.model_validate(obj)


@router.put(
    "/{boat_pricing_id}",
    response_model=BoatPricingPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    boat_pricing_id: uuid.UUID,
    boat_pricing_in: BoatPricingUpdate,
) -> BoatPricingPublic:
    """Update boat pricing."""
    obj = crud.get_boat_pricing(session=session, boat_pricing_id=boat_pricing_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boat pricing not found",
        )
    if (
        boat_pricing_in.ticket_type is not None
        and boat_pricing_in.ticket_type != obj.ticket_type
    ):
        existing = session.exec(
            select(BoatPricing).where(
                BoatPricing.boat_id == obj.boat_id,
                BoatPricing.ticket_type == boat_pricing_in.ticket_type,
                BoatPricing.id != boat_pricing_id,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Pricing for ticket type '{boat_pricing_in.ticket_type}' "
                    "already exists for this boat"
                ),
            )
    new_capacity = (
        boat_pricing_in.capacity
        if boat_pricing_in.capacity is not None
        else obj.capacity
    )
    other_rows = [
        bp
        for bp in crud.get_boat_pricing_by_boat(session=session, boat_id=obj.boat_id)
        if bp.id != boat_pricing_id
    ]
    total_capacity = sum(bp.capacity for bp in other_rows) + new_capacity
    boat = session.get(Boat, obj.boat_id)
    if boat and total_capacity > boat.capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Sum of ticket-type capacities ({total_capacity}) would exceed "
                f"boat capacity ({boat.capacity})"
            ),
        )
    old_ticket_type = obj.ticket_type
    new_ticket_type = (
        boat_pricing_in.ticket_type
        if boat_pricing_in.ticket_type is not None
        else old_ticket_type
    )
    obj = crud.update_boat_pricing(session=session, db_obj=obj, obj_in=boat_pricing_in)
    if old_ticket_type != new_ticket_type:
        crud.cascade_boat_ticket_type_rename(
            session=session,
            boat_id=obj.boat_id,
            old_ticket_type=old_ticket_type,
            new_ticket_type=new_ticket_type,
        )
    return BoatPricingPublic.model_validate(obj)


@router.delete(
    "/{boat_pricing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_boat_pricing(
    *,
    session: Session = Depends(deps.get_db),
    boat_pricing_id: uuid.UUID,
) -> None:
    """Delete boat pricing."""
    obj = crud.get_boat_pricing(session=session, boat_pricing_id=boat_pricing_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boat pricing not found",
        )
    crud.delete_boat_pricing(session=session, boat_pricing_id=boat_pricing_id)
