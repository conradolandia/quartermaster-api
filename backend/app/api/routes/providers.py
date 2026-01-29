import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    ProviderCreate,
    ProviderPublic,
    ProvidersPublic,
    ProviderUpdate,
)

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/public/", response_model=ProvidersPublic)
def read_public_providers(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    jurisdiction_id: uuid.UUID = None,
) -> Any:
    """
    Retrieve providers with optional filtering by jurisdiction (public endpoint).
    """
    if jurisdiction_id:
        providers = crud.get_providers_by_jurisdiction(
            session=session, jurisdiction_id=jurisdiction_id, skip=skip, limit=limit
        )
        count = len(providers)
    else:
        providers = crud.get_providers(session=session, skip=skip, limit=limit)
        count = crud.get_providers_count(session=session)

    return ProvidersPublic(data=providers, count=count)


@router.get(
    "/",
    response_model=ProvidersPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_providers(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    jurisdiction_id: uuid.UUID = None,
) -> Any:
    """
    Retrieve providers with optional filtering by jurisdiction.
    """
    if jurisdiction_id:
        providers = crud.get_providers_by_jurisdiction(
            session=session, jurisdiction_id=jurisdiction_id, skip=skip, limit=limit
        )
        count = len(providers)
    else:
        providers = crud.get_providers(session=session, skip=skip, limit=limit)
        count = crud.get_providers_count(session=session)

    return ProvidersPublic(data=providers, count=count)


@router.post(
    "/",
    response_model=ProviderPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_provider(
    *,
    session: Session = Depends(deps.get_db),
    provider_in: ProviderCreate,
) -> Any:
    """
    Create new provider.
    """
    # Check if jurisdiction exists
    jurisdiction = crud.get_jurisdiction(
        session=session, jurisdiction_id=provider_in.jurisdiction_id
    )
    if not jurisdiction:
        raise HTTPException(
            status_code=404,
            detail=f"Jurisdiction with ID {provider_in.jurisdiction_id} not found",
        )

    provider = crud.create_provider(session=session, provider_in=provider_in)
    return provider


@router.get(
    "/{provider_id}",
    response_model=ProviderPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_provider(
    *,
    session: Session = Depends(deps.get_db),
    provider_id: str,
) -> Any:
    """
    Get provider by ID.
    """
    provider = crud.get_provider(session=session, provider_id=provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with ID {provider_id} not found",
        )
    return provider


@router.put(
    "/{provider_id}",
    response_model=ProviderPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_provider(
    *,
    session: Session = Depends(deps.get_db),
    provider_id: str,
    provider_in: ProviderUpdate,
) -> Any:
    """
    Update a provider.
    """
    provider = crud.get_provider(session=session, provider_id=provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with ID {provider_id} not found",
        )

    # If jurisdiction_id is being updated, check if the new jurisdiction exists
    if (
        provider_in.jurisdiction_id
        and provider_in.jurisdiction_id != provider.jurisdiction_id
    ):
        jurisdiction = crud.get_jurisdiction(
            session=session, jurisdiction_id=provider_in.jurisdiction_id
        )
        if not jurisdiction:
            raise HTTPException(
                status_code=404,
                detail=f"Jurisdiction with ID {provider_in.jurisdiction_id} not found",
            )

    provider = crud.update_provider(
        session=session, db_obj=provider, obj_in=provider_in
    )
    return provider


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_provider(
    *,
    session: Session = Depends(deps.get_db),
    provider_id: str,
) -> None:
    """
    Delete a provider.
    """
    provider = crud.get_provider(session=session, provider_id=provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with ID {provider_id} not found",
        )

    try:
        crud.delete_provider(session=session, db_obj=provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/jurisdiction/{jurisdiction_id}",
    response_model=ProvidersPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_providers_by_jurisdiction(
    *,
    session: Session = Depends(deps.get_db),
    jurisdiction_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve providers for a specific jurisdiction.
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

    providers = crud.get_providers_by_jurisdiction(
        session=session, jurisdiction_id=jurisdiction_id, skip=skip, limit=limit
    )
    count = len(providers)

    return ProvidersPublic(data=providers, count=count)


# Public endpoints (no authentication required)
@router.get("/public/{provider_id}", response_model=ProviderPublic)
def read_public_provider(
    *,
    session: Session = Depends(deps.get_db),
    provider_id: uuid.UUID,
) -> Any:
    """
    Get provider by ID for public access.
    No authentication required.
    """
    provider = crud.get_provider(session=session, provider_id=provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with ID {provider_id} not found",
        )
    return provider
