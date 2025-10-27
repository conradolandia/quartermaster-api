import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    LocationCreate,
    LocationPublic,
    LocationsPublic,
    LocationUpdate,
)

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get(
    "/",
    response_model=LocationsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_locations(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve locations.
    """
    locations = crud.get_locations_no_relationships(
        session=session, skip=skip, limit=limit
    )
    count = crud.get_locations_count(session=session)
    return LocationsPublic(data=locations, count=count)


@router.post(
    "/",
    response_model=LocationPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_location(
    *,
    session: Session = Depends(deps.get_db),
    location_in: LocationCreate,
) -> Any:
    """
    Create new location.
    """
    location = crud.create_location(session=session, location_in=location_in)
    return location


@router.get(
    "/{location_id}",
    response_model=LocationPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: uuid.UUID,
) -> Any:
    """
    Get location by ID.
    """
    location = crud.get_location(session=session, location_id=location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {location_id} not found",
        )
    return location


@router.put(
    "/{location_id}",
    response_model=LocationPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: uuid.UUID,
    location_in: LocationUpdate,
) -> Any:
    """
    Update a location.
    """
    location = crud.get_location(session=session, location_id=location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {location_id} not found",
        )
    location = crud.update_location(
        session=session, db_obj=location, obj_in=location_in
    )
    return location


@router.delete(
    "/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: uuid.UUID,
) -> None:
    """
    Delete a location.
    """
    location = crud.get_location(session=session, location_id=location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {location_id} not found",
        )

    crud.delete_location(session=session, db_obj=location)
