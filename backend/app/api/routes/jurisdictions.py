import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    JurisdictionCreate,
    JurisdictionPublic,
    JurisdictionsPublic,
    JurisdictionUpdate,
)

router = APIRouter(prefix="/jurisdictions", tags=["jurisdictions"])


@router.get("/public/", response_model=JurisdictionsPublic)
def read_public_jurisdictions(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    location_id: uuid.UUID = None,
) -> Any:
    """
    Retrieve jurisdictions with optional filtering by location (public endpoint).
    Used by public booking form to calculate tax rates.
    """
    if location_id:
        jurisdictions = crud.get_jurisdictions_by_location(
            session=session, location_id=location_id, skip=skip, limit=limit
        )
        # For simplicity, we're not implementing a count method for filtered results
        # In a production app, we would add this for proper pagination
        count = len(jurisdictions)
    else:
        jurisdictions = crud.get_jurisdictions(session=session, skip=skip, limit=limit)
        count = crud.get_jurisdictions_count(session=session)

    return JurisdictionsPublic(data=jurisdictions, count=count)


@router.get(
    "/",
    response_model=JurisdictionsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_jurisdictions(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    location_id: uuid.UUID = None,
) -> Any:
    """
    Retrieve jurisdictions with optional filtering by location.
    """
    if location_id:
        jurisdictions = crud.get_jurisdictions_by_location(
            session=session, location_id=location_id, skip=skip, limit=limit
        )
        # For simplicity, we're not implementing a count method for filtered results
        # In a production app, we would add this for proper pagination
        count = len(jurisdictions)
    else:
        jurisdictions = crud.get_jurisdictions(session=session, skip=skip, limit=limit)
        count = crud.get_jurisdictions_count(session=session)

    return JurisdictionsPublic(data=jurisdictions, count=count)


@router.post(
    "/",
    response_model=JurisdictionPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_jurisdiction(
    *,
    session: Session = Depends(deps.get_db),
    jurisdiction_in: JurisdictionCreate,
) -> Any:
    """
    Create new jurisdiction.
    """
    # The check for existing ID (derived from name/state) is now handled in crud.create_jurisdiction
    # jurisdiction = crud.get_jurisdiction(
    #     session=session, jurisdiction_id=jurisdiction_in.id
    # )
    # if jurisdiction:
    #     raise HTTPException(
    #         status_code=400,
    #         detail=f"Jurisdiction with ID {jurisdiction_in.id} already exists",
    #     )

    # Check if a jurisdiction with this slug already exists - REMOVED
    # if jurisdiction_in.slug:
    #     jurisdiction_by_slug = crud.get_jurisdiction_by_slug(
    #         session=session, slug=jurisdiction_in.slug
    #     )
    #     if jurisdiction_by_slug:
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"Jurisdiction with slug {jurisdiction_in.slug} already exists",
    #         )

    # Check if location exists - Still needed
    location = crud.get_location(
        session=session, location_id=jurisdiction_in.location_id
    )
    if not location:
        raise HTTPException(
            status_code=404,
            detail=f"Location with ID {jurisdiction_in.location_id} not found",
        )

    jurisdiction = crud.create_jurisdiction(
        session=session, jurisdiction_in=jurisdiction_in
    )
    return jurisdiction


@router.get(
    "/{jurisdiction_id}",
    response_model=JurisdictionPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_jurisdiction(
    *,
    session: Session = Depends(deps.get_db),
    jurisdiction_id: str,
) -> Any:
    """
    Get jurisdiction by ID.
    """
    jurisdiction = crud.get_jurisdiction(
        session=session, jurisdiction_id=jurisdiction_id
    )
    if not jurisdiction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Jurisdiction with ID {jurisdiction_id} not found",
        )
    return jurisdiction


@router.put(
    "/{jurisdiction_id}",
    response_model=JurisdictionPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_jurisdiction(
    *,
    session: Session = Depends(deps.get_db),
    jurisdiction_id: str,
    jurisdiction_in: JurisdictionUpdate,
) -> Any:
    """
    Update a jurisdiction.
    """
    jurisdiction = crud.get_jurisdiction(
        session=session, jurisdiction_id=jurisdiction_id
    )
    if not jurisdiction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Jurisdiction with ID {jurisdiction_id} not found",
        )

    # Check if slug is being updated and if it already exists - REMOVED
    # if jurisdiction_in.slug and jurisdiction_in.slug != jurisdiction.slug:
    #     jurisdiction_by_slug = crud.get_jurisdiction_by_slug(
    #         session=session, slug=jurisdiction_in.slug
    #     )
    #     if jurisdiction_by_slug and jurisdiction_by_slug.id != jurisdiction_id:
    #         raise HTTPException(
    #             status_code=400,
    #             detail=f"Jurisdiction with slug {jurisdiction_in.slug} already exists",
    #         )

    # If location_id is being updated, check if the new location exists - Still needed
    if (
        jurisdiction_in.location_id
        and jurisdiction_in.location_id != jurisdiction.location_id
    ):
        location = crud.get_location(
            session=session, location_id=jurisdiction_in.location_id
        )
        if not location:
            raise HTTPException(
                status_code=404,
                detail=f"Location with ID {jurisdiction_in.location_id} not found",
            )

    # Check for ID change due to name/state update is handled in crud.update_jurisdiction

    jurisdiction = crud.update_jurisdiction(
        session=session, db_obj=jurisdiction, obj_in=jurisdiction_in
    )
    return jurisdiction


@router.delete(
    "/{jurisdiction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_jurisdiction(
    *,
    session: Session = Depends(deps.get_db),
    jurisdiction_id: str,
) -> None:
    """
    Delete a jurisdiction.
    """
    jurisdiction = crud.get_jurisdiction(
        session=session, jurisdiction_id=jurisdiction_id
    )
    if not jurisdiction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Jurisdiction with ID {jurisdiction_id} not found",
        )

    crud.delete_jurisdiction(session=session, db_obj=jurisdiction)
