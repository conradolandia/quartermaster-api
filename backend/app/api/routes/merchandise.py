import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    MerchandiseCreate,
    MerchandisePublic,
    MerchandisesPublic,
    MerchandiseUpdate,
    MerchandiseVariationCreate,
    MerchandiseVariationPublic,
    MerchandiseVariationUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/merchandise", tags=["merchandise"])


def _merchandise_to_public(session: Session, merchandise: Any) -> MerchandisePublic:
    """Build MerchandisePublic with quantity_available computed from variations when present."""
    pub = MerchandisePublic.model_validate(merchandise)
    variations = crud.list_merchandise_variations_by_merchandise(
        session=session, merchandise_id=merchandise.id
    )
    if variations:
        pub.quantity_available = sum(
            v.quantity_total - v.quantity_sold for v in variations
        )
        pub.variant_options = ",".join(v.variant_value for v in variations)
        pub.variant_name = None
    return pub


@router.get(
    "/",
    response_model=MerchandisesPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_merchandise_list(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve merchandise (catalog) with pagination. quantity_available is computed from variations when present.
    """
    items = crud.get_merchandise_list(session=session, skip=skip, limit=limit)
    count = crud.get_merchandise_count(session=session)
    return MerchandisesPublic(
        data=[_merchandise_to_public(session, m) for m in items],
        count=count,
    )


@router.post(
    "/",
    response_model=MerchandisePublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_in: MerchandiseCreate,
) -> Any:
    """
    Create new merchandise (catalog item).
    """
    merchandise = crud.create_merchandise(
        session=session, merchandise_in=merchandise_in
    )
    logger.info("Created merchandise: %s", merchandise.id)
    return _merchandise_to_public(session, merchandise)


@router.get(
    "/{merchandise_id}",
    response_model=MerchandisePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
) -> Any:
    """
    Get merchandise by ID.
    """
    merchandise = crud.get_merchandise(session=session, merchandise_id=merchandise_id)
    if not merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Merchandise with ID {merchandise_id} not found",
        )
    return merchandise


@router.put(
    "/{merchandise_id}",
    response_model=MerchandisePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
    merchandise_in: MerchandiseUpdate,
) -> Any:
    """
    Update merchandise.
    """
    merchandise = crud.get_merchandise(session=session, merchandise_id=merchandise_id)
    if not merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Merchandise with ID {merchandise_id} not found",
        )
    merchandise = crud.update_merchandise(
        session=session, db_obj=merchandise, obj_in=merchandise_in
    )
    logger.info("Updated merchandise: %s", merchandise_id)
    return _merchandise_to_public(session, merchandise)


@router.delete(
    "/{merchandise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
) -> None:
    """
    Delete merchandise. Fails if still offered on any trip.
    """
    try:
        crud.delete_merchandise(session=session, merchandise_id=merchandise_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    logger.info("Deleted merchandise: %s", merchandise_id)


# --- Merchandise variations (per-variant inventory) ---


@router.get(
    "/{merchandise_id}/variations",
    response_model=list[MerchandiseVariationPublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_merchandise_variations(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
) -> Any:
    """
    List variations for a merchandise (quantity_total, quantity_sold, quantity_fulfilled per variant).
    """
    merchandise = crud.get_merchandise(session=session, merchandise_id=merchandise_id)
    if not merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Merchandise with ID {merchandise_id} not found",
        )
    variations = crud.list_merchandise_variations_by_merchandise(
        session=session, merchandise_id=merchandise_id
    )
    return variations


@router.post(
    "/{merchandise_id}/variations",
    response_model=MerchandiseVariationPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_merchandise_variation(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
    variation_in: MerchandiseVariationCreate,
) -> Any:
    """
    Create a new variation for a merchandise. merchandise_id in body must match path.
    """
    merchandise = crud.get_merchandise(session=session, merchandise_id=merchandise_id)
    if not merchandise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Merchandise with ID {merchandise_id} not found",
        )
    if variation_in.merchandise_id != merchandise_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="merchandise_id in body must match path",
        )
    existing = crud.get_merchandise_variation_by_merchandise_and_value(
        session=session,
        merchandise_id=merchandise_id,
        variant_value=variation_in.variant_value,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Variation with value '{variation_in.variant_value}' already exists",
        )
    variation = crud.create_merchandise_variation(
        session=session, variation_in=variation_in
    )
    logger.info("Created merchandise variation: %s", variation.id)
    return variation


@router.get(
    "/{merchandise_id}/variations/{variation_id}",
    response_model=MerchandiseVariationPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_merchandise_variation(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> Any:
    """
    Get a merchandise variation by ID. Must belong to the given merchandise.
    """
    variation = crud.get_merchandise_variation(
        session=session, variation_id=variation_id
    )
    if not variation or variation.merchandise_id != merchandise_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variation not found",
        )
    return variation


@router.put(
    "/{merchandise_id}/variations/{variation_id}",
    response_model=MerchandiseVariationPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_merchandise_variation(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
    variation_id: uuid.UUID,
    variation_in: MerchandiseVariationUpdate,
) -> Any:
    """
    Update a merchandise variation (e.g. variant_value, quantity_total).
    """
    variation = crud.get_merchandise_variation(
        session=session, variation_id=variation_id
    )
    if not variation or variation.merchandise_id != merchandise_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variation not found",
        )
    if (
        variation_in.variant_value is not None
        and variation_in.variant_value != variation.variant_value
    ):
        existing = crud.get_merchandise_variation_by_merchandise_and_value(
            session=session,
            merchandise_id=merchandise_id,
            variant_value=variation_in.variant_value.strip(),
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Variation '{variation_in.variant_value}' already exists",
            )
    variation = crud.update_merchandise_variation(
        session=session, db_obj=variation, obj_in=variation_in
    )
    logger.info("Updated merchandise variation: %s", variation_id)
    return variation


@router.delete(
    "/{merchandise_id}/variations/{variation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_merchandise_variation(
    *,
    session: Session = Depends(deps.get_db),
    merchandise_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> None:
    """
    Delete a merchandise variation. Fails if booking items reference it.
    """
    variation = crud.get_merchandise_variation(
        session=session, variation_id=variation_id
    )
    if not variation or variation.merchandise_id != merchandise_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variation not found",
        )
    from sqlmodel import select

    from app.models import BookingItem

    ref = session.exec(
        select(BookingItem).where(BookingItem.merchandise_variation_id == variation_id)
    ).first()
    if ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete variation: it is referenced by booking items",
        )
    crud.delete_merchandise_variation(session=session, variation_id=variation_id)
    logger.info("Deleted merchandise variation: %s", variation_id)
