import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    BoatCreate,
    BoatPublic,
    BoatsPublic,
    BoatUpdate,
)

router = APIRouter(prefix="/boats", tags=["boats"])


@router.get(
    "/",
    response_model=BoatsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_boats(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve boats.
    """
    boats = crud.get_boats_no_relationships(session=session, skip=skip, limit=limit)
    count = crud.get_boats_count(session=session)
    return BoatsPublic(data=boats, count=count)


@router.post(
    "/",
    response_model=BoatPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_boat(
    *,
    session: Session = Depends(deps.get_db),
    boat_in: BoatCreate,
) -> Any:
    """
    Create new boat.
    """
    # Verify that the jurisdiction exists
    jurisdiction = crud.get_jurisdiction(
        session=session, jurisdiction_id=boat_in.jurisdiction_id
    )
    if not jurisdiction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Jurisdiction with ID {boat_in.jurisdiction_id} not found",
        )

    boat = crud.create_boat(session=session, boat_in=boat_in)
    return boat


@router.get(
    "/{boat_id}",
    response_model=BoatPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_boat(
    *,
    session: Session = Depends(deps.get_db),
    boat_id: uuid.UUID,
) -> Any:
    """
    Get boat by ID.
    """
    boat = crud.get_boat(session=session, boat_id=boat_id)
    if not boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Boat with ID {boat_id} not found",
        )
    return boat


@router.put(
    "/{boat_id}",
    response_model=BoatPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_boat(
    *,
    session: Session = Depends(deps.get_db),
    boat_id: uuid.UUID,
    boat_in: BoatUpdate,
) -> Any:
    """
    Update a boat.
    """
    boat = crud.get_boat(session=session, boat_id=boat_id)
    if not boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Boat with ID {boat_id} not found",
        )

    # If jurisdiction_id is being updated, verify that the new jurisdiction exists
    if boat_in.jurisdiction_id is not None:
        jurisdiction = crud.get_jurisdiction(
            session=session, jurisdiction_id=boat_in.jurisdiction_id
        )
        if not jurisdiction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Jurisdiction with ID {boat_in.jurisdiction_id} not found",
            )

    boat = crud.update_boat(session=session, db_obj=boat, obj_in=boat_in)
    return boat


@router.delete(
    "/{boat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_boat(
    *,
    session: Session = Depends(deps.get_db),
    boat_id: uuid.UUID,
) -> None:
    """
    Delete a boat.
    """
    boat = crud.get_boat(session=session, boat_id=boat_id)
    if not boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Boat with ID {boat_id} not found",
        )

    crud.delete_boat(session=session, db_obj=boat)


@router.get(
    "/jurisdiction/{jurisdiction_id}",
    response_model=BoatsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_boats_by_jurisdiction(
    *,
    session: Session = Depends(deps.get_db),
    jurisdiction_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve boats for a specific jurisdiction.
    """
    # Verify that the jurisdiction exists
    jurisdiction = crud.get_jurisdiction(
        session=session, jurisdiction_id=jurisdiction_id
    )
    if not jurisdiction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Jurisdiction with ID {jurisdiction_id} not found",
        )

    boats = crud.get_boats_by_jurisdiction(
        session=session, jurisdiction_id=jurisdiction_id, skip=skip, limit=limit
    )
    count = len(boats)

    # Convert to dictionaries to break the ORM relationship chain
    boat_dicts = [
        {
            "id": boat.id,
            "name": boat.name,
            "slug": boat.slug,
            "capacity": boat.capacity,
            "provider_name": boat.provider_name,
            "provider_location": boat.provider_location,
            "provider_address": boat.provider_address,
            "jurisdiction_id": boat.jurisdiction_id,
            "map_link": boat.map_link,
            "created_at": boat.created_at,
            "updated_at": boat.updated_at,
        }
        for boat in boats
    ]

    return BoatsPublic(data=boat_dicts, count=count)
