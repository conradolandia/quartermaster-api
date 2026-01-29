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
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/merchandise", tags=["merchandise"])


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
    Retrieve merchandise (catalog) with pagination.
    """
    items = crud.get_merchandise_list(session=session, skip=skip, limit=limit)
    count = crud.get_merchandise_count(session=session)
    return MerchandisesPublic(data=items, count=count)


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
    return merchandise


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
    return merchandise


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
