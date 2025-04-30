from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.models import (
    LocationCreate,
    LocationPublic,
    LocationsPublic,
    LocationUpdate,
)

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/", response_model=LocationsPublic)
def read_locations(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve locations.
    """
    locations = crud.get_locations(session=session, skip=skip, limit=limit)
    count = crud.get_locations_count(session=session)
    return LocationsPublic(data=locations, count=count)


@router.post("/", response_model=LocationPublic, status_code=status.HTTP_201_CREATED)
def create_location(
    *,
    session: Session = Depends(deps.get_db),
    location_in: LocationCreate,
) -> Any:
    """
    Create new location.
    """
    location = crud.get_location(session=session, location_id=location_in.id)
    if location:
        raise HTTPException(
            status_code=400,
            detail=f"Location with ID {location_in.id} already exists",
        )

    # Check if a location with this slug already exists
    if location_in.slug:
        location_by_slug = crud.get_location_by_slug(
            session=session, slug=location_in.slug
        )
        if location_by_slug:
            raise HTTPException(
                status_code=400,
                detail=f"Location with slug {location_in.slug} already exists",
            )

    location = crud.create_location(session=session, location_in=location_in)
    return location


@router.get("/{location_id}", response_model=LocationPublic)
def read_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: str,
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


@router.put("/{location_id}", response_model=LocationPublic)
def update_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: str,
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

    # Check if slug is being updated and if it already exists
    if location_in.slug and location_in.slug != location.slug:
        location_by_slug = crud.get_location_by_slug(
            session=session, slug=location_in.slug
        )
        if location_by_slug and location_by_slug.id != location_id:
            raise HTTPException(
                status_code=400,
                detail=f"Location with slug {location_in.slug} already exists",
            )

    location = crud.update_location(
        session=session, db_obj=location, obj_in=location_in
    )
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: str,
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

    # Check if this location has related jurisdictions
    # This would require foreign key checks, which we'll implement later
    # when we create the Jurisdiction model

    crud.delete_location(session=session, db_obj=location)
