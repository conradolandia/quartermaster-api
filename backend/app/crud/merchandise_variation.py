"""
Merchandise variation CRUD operations (per-variant inventory).
"""

import uuid

from sqlmodel import Session, select

from app.models import (
    MerchandiseVariation,
    MerchandiseVariationCreate,
    MerchandiseVariationUpdate,
)


def get_merchandise_variation(
    *, session: Session, variation_id: uuid.UUID
) -> MerchandiseVariation | None:
    """Get a merchandise variation by ID."""
    return session.get(MerchandiseVariation, variation_id)


def get_merchandise_variation_by_merchandise_and_value(
    *, session: Session, merchandise_id: uuid.UUID, variant_value: str
) -> MerchandiseVariation | None:
    """Get variation by merchandise and variant_value (e.g. for resolving variant_option)."""
    return session.exec(
        select(MerchandiseVariation).where(
            MerchandiseVariation.merchandise_id == merchandise_id,
            MerchandiseVariation.variant_value == variant_value,
        )
    ).first()


def list_merchandise_variations_by_merchandise(
    *, session: Session, merchandise_id: uuid.UUID
) -> list[MerchandiseVariation]:
    """List all variations for a merchandise, ordered by variant_value."""
    return session.exec(
        select(MerchandiseVariation)
        .where(MerchandiseVariation.merchandise_id == merchandise_id)
        .order_by(MerchandiseVariation.variant_value)
    ).all()


def create_merchandise_variation(
    *, session: Session, variation_in: MerchandiseVariationCreate
) -> MerchandiseVariation:
    """Create a new merchandise variation."""
    db_obj = MerchandiseVariation.model_validate(variation_in)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_merchandise_variation(
    *,
    session: Session,
    db_obj: MerchandiseVariation,
    obj_in: MerchandiseVariationUpdate,
) -> MerchandiseVariation:
    """Update a merchandise variation (variant_value, quantity_total, quantity_sold, quantity_fulfilled)."""
    obj_data = obj_in.model_dump(exclude_unset=True)
    if "variant_value" in obj_data and obj_data["variant_value"] is not None:
        obj_data["variant_value"] = str(obj_data["variant_value"]).strip()
    db_obj.sqlmodel_update(obj_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_merchandise_variation(
    *, session: Session, variation_id: uuid.UUID
) -> MerchandiseVariation | None:
    """Delete a merchandise variation. Returns None if not found."""
    variation = session.get(MerchandiseVariation, variation_id)
    if not variation:
        return None
    session.delete(variation)
    session.commit()
    return variation
