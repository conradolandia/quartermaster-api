import uuid
from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    ItemCreate,
    Jurisdiction,
    JurisdictionCreate,
    JurisdictionUpdate,
    Location,
    LocationCreate,
    LocationUpdate,
    User,
    UserCreate,
    UserUpdate,
)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


# Location CRUD operations
def create_location(*, session: Session, location_in: LocationCreate) -> Location:
    """Create a new location with UUID as ID."""
    db_obj = Location.model_validate(location_in.model_dump())
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_location(*, session: Session, location_id: uuid.UUID) -> Location | None:
    """Get a location by ID."""
    return session.get(Location, location_id)


def get_locations(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Location]:
    """Get a list of locations with pagination."""
    statement = select(Location).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_locations_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get a list of locations without loading related jurisdictions to avoid recursion.
    Returns dictionaries instead of ORM objects to break relationship chains.
    """
    statement = select(Location).offset(skip).limit(limit)
    locations = session.exec(statement).all()

    # Convert to dictionaries to break the ORM relationship chain
    return [
        {
            "id": loc.id,
            "name": loc.name,
            "state": loc.state,
            "created_at": loc.created_at,
            "updated_at": loc.updated_at,
        }
        for loc in locations
    ]


def get_locations_count(*, session: Session) -> int:
    """Get the total count of locations."""
    statement = select(Location)
    return len(session.exec(statement).all())


def update_location(
    *, session: Session, db_obj: Location, obj_in: LocationUpdate
) -> Location:
    """Update a location."""
    update_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(update_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_location(*, session: Session, db_obj: Location) -> None:
    """Delete a location."""
    session.delete(db_obj)
    session.commit()


# Jurisdiction CRUD operations
def create_jurisdiction(
    *, session: Session, jurisdiction_in: JurisdictionCreate
) -> Jurisdiction:
    """Create a new jurisdiction with UUID as ID."""
    db_obj = Jurisdiction.model_validate(jurisdiction_in.model_dump())
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID
) -> Jurisdiction | None:
    """Get a jurisdiction by ID."""
    return session.get(Jurisdiction, jurisdiction_id)


def get_jurisdictions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Jurisdiction]:
    """Get a list of jurisdictions with pagination."""
    statement = select(Jurisdiction).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_jurisdictions_by_location(
    *, session: Session, location_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Jurisdiction]:
    """Get jurisdictions for a specific location."""
    statement = (
        select(Jurisdiction)
        .where(Jurisdiction.location_id == location_id)
        .offset(skip)
        .limit(limit)
    )
    return session.exec(statement).all()


def get_jurisdictions_count(*, session: Session) -> int:
    """Get the total count of jurisdictions."""
    statement = select(Jurisdiction)
    return len(session.exec(statement).all())


def update_jurisdiction(
    *, session: Session, db_obj: Jurisdiction, obj_in: JurisdictionUpdate
) -> Jurisdiction:
    """Update a jurisdiction."""
    update_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(update_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_jurisdiction(*, session: Session, db_obj: Jurisdiction) -> None:
    """Delete a jurisdiction."""
    session.delete(db_obj)
    session.commit()
