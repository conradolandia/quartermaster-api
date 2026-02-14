"""
Provider CRUD operations.
"""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models import (
    Provider,
    ProviderCreate,
    ProviderUpdate,
)


def create_provider(*, session: Session, provider_in: ProviderCreate) -> Provider:
    """Create a new provider."""
    # Verify jurisdiction exists
    from app.crud.jurisdictions import get_jurisdiction

    jurisdiction = get_jurisdiction(
        session=session, jurisdiction_id=provider_in.jurisdiction_id
    )
    if not jurisdiction:
        raise ValueError(
            f"Jurisdiction with ID {provider_in.jurisdiction_id} not found"
        )

    db_obj = Provider.model_validate(provider_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    # Eager load jurisdiction relationship for API serialization
    if db_obj.jurisdiction_id:
        session.refresh(db_obj, ["jurisdiction"])
    return db_obj


def get_provider(*, session: Session, provider_id: uuid.UUID) -> Provider | None:
    """Get a provider by ID."""
    statement = (
        select(Provider)
        .where(Provider.id == provider_id)
        .options(selectinload(Provider.jurisdiction))
    )
    provider = session.exec(statement).first()
    return provider


def get_providers(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Provider]:
    """Get multiple providers."""
    statement = (
        select(Provider)
        .options(selectinload(Provider.jurisdiction))
        .offset(skip)
        .limit(limit)
    )
    providers = session.exec(statement).all()
    return providers


def get_providers_by_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Provider]:
    """Get providers by jurisdiction."""
    statement = (
        select(Provider)
        .where(Provider.jurisdiction_id == jurisdiction_id)
        .options(selectinload(Provider.jurisdiction))
        .offset(skip)
        .limit(limit)
    )
    providers = session.exec(statement).all()
    return providers


def get_providers_count(*, session: Session) -> int:
    """Get the total count of providers."""
    count = session.exec(select(func.count(Provider.id))).first()
    return count or 0


def update_provider(
    *, session: Session, db_obj: Provider, obj_in: ProviderUpdate
) -> Provider:
    """Update a provider."""
    from app.crud.jurisdictions import get_jurisdiction

    obj_data = obj_in.model_dump(exclude_unset=True)

    # If jurisdiction_id is being updated, verify the new jurisdiction exists
    if (
        "jurisdiction_id" in obj_data
        and obj_data["jurisdiction_id"] != db_obj.jurisdiction_id
    ):
        jurisdiction = get_jurisdiction(
            session=session, jurisdiction_id=obj_data["jurisdiction_id"]
        )
        if not jurisdiction:
            raise ValueError(
                f"Jurisdiction with ID {obj_data['jurisdiction_id']} not found"
            )

    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj, ["jurisdiction"])
    return db_obj


def delete_provider(*, session: Session, db_obj: Provider) -> None:
    """Delete a provider."""
    # Check if any boats reference this provider
    from app.models import Boat

    boats_count = session.exec(
        select(func.count(Boat.id)).where(Boat.provider_id == db_obj.id)
    ).first()

    if boats_count and boats_count > 0:
        raise ValueError(
            f"Cannot delete this provider: {boats_count} boat(s) are still associated. Remove or reassign the boats first."
        )

    session.delete(db_obj)
    session.commit()
