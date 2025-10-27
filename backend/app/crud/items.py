"""
Item CRUD operations.
"""

import uuid

from sqlmodel import Session

from app.models import Item, ItemCreate


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    """Create a new item."""
    db_obj = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj
