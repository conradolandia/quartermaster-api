import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    Merchandise,
    TripMerchandise,
    TripMerchandiseCreate,
    TripMerchandisePublic,
    TripMerchandiseUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trip-merchandise", tags=["trip-merchandise"])


def _trip_merchandise_to_public(
    tm: TripMerchandise, m: Merchandise
) -> TripMerchandisePublic:
    """Build TripMerchandisePublic from TripMerchandise + Merchandise (effective price and quantity)."""
    price = tm.price_override if tm.price_override is not None else m.price
    qty = (
        tm.quantity_available_override
        if tm.quantity_available_override is not None
        else m.quantity_available
    )
    return TripMerchandisePublic(
        id=tm.id,
        trip_id=tm.trip_id,
        merchandise_id=tm.merchandise_id,
        name=m.name,
        description=m.description,
        price=price,
        quantity_available=qty,
        variant_name=m.variant_name,
        variant_options=m.variant_options,
        created_at=tm.created_at,
        updated_at=tm.updated_at,
    )


@router.post(
    "/",
    response_model=TripMerchandisePublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_in: TripMerchandiseCreate,
) -> Any:
    """
    Create new trip merchandise (link trip to catalog merchandise with optional overrides).
    """
    trip_merchandise = crud.create_trip_merchandise(
        session=session, trip_merchandise_in=trip_merchandise_in
    )
    session.refresh(trip_merchandise, ["merchandise"])
    m = trip_merchandise.merchandise
    if not m:
        m = crud.get_merchandise(
            session=session, merchandise_id=trip_merchandise.merchandise_id
        )
    if not m:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Merchandise not found after create",
        )
    logger.info("Created trip merchandise: %s", trip_merchandise.id)
    return _trip_merchandise_to_public(trip_merchandise, m)


@router.get(
    "/",
    response_model=list[TripMerchandisePublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID | None = None,
) -> Any:
    """
    List trip merchandise with optional filtering by trip_id. Returns effective name, price, quantity.
    """
    query = (
        select(TripMerchandise)
        .options(selectinload(TripMerchandise.merchandise))
        .order_by(TripMerchandise.created_at)
    )
    if trip_id:
        query = query.where(TripMerchandise.trip_id == trip_id)
    trip_merchandise_list = session.exec(query).all()
    out = []
    for tm in trip_merchandise_list:
        m = tm.merchandise
        if not m:
            m = crud.get_merchandise(session=session, merchandise_id=tm.merchandise_id)
        if m:
            out.append(_trip_merchandise_to_public(tm, m))
    return out


@router.get(
    "/{trip_merchandise_id}",
    response_model=TripMerchandisePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_id: uuid.UUID,
) -> Any:
    """
    Get trip merchandise by ID.
    """
    trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
    if not trip_merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip merchandise with ID {trip_merchandise_id} not found",
        )
    session.refresh(trip_merchandise, ["merchandise"])
    m = trip_merchandise.merchandise or crud.get_merchandise(
        session=session, merchandise_id=trip_merchandise.merchandise_id
    )
    if not m:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchandise not found",
        )
    return _trip_merchandise_to_public(trip_merchandise, m)


@router.put(
    "/{trip_merchandise_id}",
    response_model=TripMerchandisePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_id: uuid.UUID,
    trip_merchandise_in: TripMerchandiseUpdate,
) -> Any:
    """
    Update trip merchandise (quantity_available_override, price_override).
    """
    trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
    if not trip_merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip merchandise with ID {trip_merchandise_id} not found",
        )
    trip_merchandise = crud.update_trip_merchandise(
        session=session,
        db_obj=trip_merchandise,
        obj_in=trip_merchandise_in,
    )
    session.refresh(trip_merchandise, ["merchandise"])
    m = trip_merchandise.merchandise or crud.get_merchandise(
        session=session, merchandise_id=trip_merchandise.merchandise_id
    )
    if not m:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchandise not found",
        )
    logger.info("Updated trip merchandise: %s", trip_merchandise_id)
    return _trip_merchandise_to_public(trip_merchandise, m)


@router.delete(
    "/{trip_merchandise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_id: uuid.UUID,
) -> None:
    """
    Delete trip merchandise (unlink trip from catalog item).
    """
    trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
    if not trip_merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip merchandise with ID {trip_merchandise_id} not found",
        )
    crud.delete_trip_merchandise(
        session=session,
        trip_merchandise_id=trip_merchandise_id,
    )
    logger.info("Deleted trip merchandise: %s", trip_merchandise_id)


@router.get("/public/", response_model=list[TripMerchandisePublic])
def list_public_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
) -> Any:
    """
    List trip merchandise for a specific trip (public endpoint for booking form).
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    booking_mode = getattr(trip, "booking_mode", "private")
    if booking_mode == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for this trip",
        )
    query = (
        select(TripMerchandise)
        .where(TripMerchandise.trip_id == trip_id)
        .options(selectinload(TripMerchandise.merchandise))
    )
    trip_merchandise_list = session.exec(query).all()
    out = []
    for tm in trip_merchandise_list:
        m = tm.merchandise
        if not m:
            m = crud.get_merchandise(session=session, merchandise_id=tm.merchandise_id)
        if m:
            out.append(_trip_merchandise_to_public(tm, m))
    return out
