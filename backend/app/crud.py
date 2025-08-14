import re
import uuid
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Boat,
    BoatCreate,
    BoatUpdate,
    Item,
    ItemCreate,
    Jurisdiction,
    JurisdictionCreate,
    JurisdictionUpdate,
    Launch,
    LaunchCreate,
    LaunchUpdate,
    Location,
    LocationCreate,
    LocationUpdate,
    Mission,
    MissionCreate,
    MissionUpdate,
    Trip,
    TripBoat,
    TripBoatCreate,
    TripBoatUpdate,
    TripCreate,
    TripUpdate,
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


# Launch CRUD operations
def create_launch(*, session: Session, launch_in: LaunchCreate) -> Launch:
    """Create a new launch with UUID as ID."""
    db_obj = Launch.model_validate(launch_in.model_dump())
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_launch(*, session: Session, launch_id: uuid.UUID) -> Launch | None:
    """Get a launch by ID."""
    return session.get(Launch, launch_id)


def get_launches(*, session: Session, skip: int = 0, limit: int = 100) -> list[Launch]:
    """Get a list of launches with pagination."""
    statement = select(Launch).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_launches_by_location(
    *, session: Session, location_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Launch]:
    """Get launches for a specific location."""
    statement = (
        select(Launch)
        .where(Launch.location_id == location_id)
        .offset(skip)
        .limit(limit)
    )
    return session.exec(statement).all()


def get_launches_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get a list of launches without loading related entities to avoid recursion.
    Returns dictionaries instead of ORM objects to break relationship chains.
    """
    statement = select(Launch).offset(skip).limit(limit)
    launches = session.exec(statement).all()

    # Convert to dictionaries to break the ORM relationship chain
    return [
        {
            "id": launch.id,
            "name": launch.name,
            "launch_timestamp": launch.launch_timestamp,
            "summary": launch.summary,
            "location_id": launch.location_id,
            "created_at": launch.created_at,
            "updated_at": launch.updated_at,
        }
        for launch in launches
    ]


def get_launches_count(*, session: Session) -> int:
    """Get the total count of launches."""
    statement = select(Launch)
    return len(session.exec(statement).all())


def update_launch(*, session: Session, db_obj: Launch, obj_in: LaunchUpdate) -> Launch:
    """Update a launch."""
    update_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(update_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_launch(*, session: Session, db_obj: Launch) -> None:
    """Delete a launch."""
    session.delete(db_obj)
    session.commit()


# Mission CRUD operations
def create_mission(*, session: Session, mission_in: MissionCreate) -> Mission:
    """Create a new mission with UUID as ID."""
    db_obj = Mission.model_validate(mission_in.model_dump())
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_mission(*, session: Session, mission_id: uuid.UUID) -> Mission | None:
    """Get a mission by ID."""
    return session.get(Mission, mission_id)


def get_missions(*, session: Session, skip: int = 0, limit: int = 100) -> list[Mission]:
    """Get a list of missions with pagination."""
    statement = select(Mission).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_missions_by_launch(
    *, session: Session, launch_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Mission]:
    """Get missions for a specific launch."""
    statement = (
        select(Mission).where(Mission.launch_id == launch_id).offset(skip).limit(limit)
    )
    return session.exec(statement).all()


def get_active_missions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Mission]:
    """Get active missions."""
    statement = select(Mission).where(Mission.active is True).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_public_missions(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Mission]:
    """Get public missions."""
    statement = select(Mission).where(Mission.public is True).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_missions_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get a list of missions without loading related entities to avoid recursion.
    Returns dictionaries instead of ORM objects to break relationship chains.
    """
    statement = select(Mission).offset(skip).limit(limit)
    missions = session.exec(statement).all()

    # Convert to dictionaries to break the ORM relationship chain
    return [
        {
            "id": mission.id,
            "name": mission.name,
            "launch_id": mission.launch_id,
            "active": mission.active,
            "public": mission.public,
            "sales_open_at": mission.sales_open_at,
            "refund_cutoff_hours": mission.refund_cutoff_hours,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
        }
        for mission in missions
    ]


def get_missions_count(*, session: Session) -> int:
    """Get the total count of missions."""
    statement = select(Mission)
    return len(session.exec(statement).all())


def update_mission(
    *, session: Session, db_obj: Mission, obj_in: MissionUpdate
) -> Mission:
    """Update a mission."""
    update_data = obj_in.model_dump(exclude_unset=True)
    db_obj.sqlmodel_update(update_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_mission(*, session: Session, db_obj: Mission) -> None:
    """Delete a mission."""
    session.delete(db_obj)
    session.commit()


# Boat CRUD operations
def create_boat(*, session: Session, boat_in: BoatCreate) -> Boat:
    """Create a new boat with UUID as ID."""
    # Convertir a diccionario para manipular antes de crear
    boat_data = boat_in.model_dump()

    # Generar slug automáticamente a partir del nombre si no se proporcionó
    if "slug" not in boat_data or not boat_data["slug"]:
        boat_data["slug"] = re.sub(r"[^a-z0-9]+", "-", boat_data["name"].lower()).strip(
            "-"
        )

    # Crear el objeto con los datos modificados
    db_obj = Boat.model_validate(boat_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_boat(*, session: Session, boat_id: uuid.UUID) -> Boat | None:
    """Get a boat by ID."""
    return session.get(Boat, boat_id)


def get_boats(*, session: Session, skip: int = 0, limit: int = 100) -> list[Boat]:
    """Get a list of boats with pagination."""
    statement = select(Boat).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_boats_by_jurisdiction(
    *, session: Session, jurisdiction_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Boat]:
    """Get boats for a specific jurisdiction."""
    statement = (
        select(Boat)
        .where(Boat.jurisdiction_id == jurisdiction_id)
        .offset(skip)
        .limit(limit)
    )
    return session.exec(statement).all()


def get_boats_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get a list of boats without loading related entities to avoid recursion.
    Returns dictionaries instead of ORM objects to break relationship chains.
    """
    statement = select(Boat).offset(skip).limit(limit)
    boats = session.exec(statement).all()

    # Convert to dictionaries to break the ORM relationship chain
    return [
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


def get_boats_count(*, session: Session) -> int:
    """Get the total count of boats."""
    statement = select(Boat)
    return len(session.exec(statement).all())


def update_boat(*, session: Session, db_obj: Boat, obj_in: BoatUpdate) -> Boat:
    """Update a boat."""
    update_data = obj_in.model_dump(exclude_unset=True)

    # Si se actualiza el nombre, regeneramos el slug automáticamente
    if "name" in update_data:
        update_data["slug"] = re.sub(
            r"[^a-z0-9]+", "-", update_data["name"].lower()
        ).strip("-")

    db_obj.sqlmodel_update(update_data)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_boat(*, session: Session, db_obj: Boat) -> None:
    """Delete a boat."""
    session.delete(db_obj)
    session.commit()


# Trip CRUD
def get_trip(*, session: Session, trip_id: uuid.UUID) -> Trip | None:
    """Get trip by ID."""
    return session.get(Trip, trip_id)


def get_trips(*, session: Session, skip: int = 0, limit: int = 100) -> list[Trip]:
    """Get all trips with relationships."""
    statement = select(Trip).offset(skip).limit(limit)
    return session.exec(statement).all()


def get_trips_no_relationships(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[Trip]:
    """Get all trips without loading relationships."""
    # Add unique() to handle the eagerly loaded collection
    # Sort by created_at descending to show newest trips first
    statement = select(Trip).order_by(Trip.created_at.desc()).offset(skip).limit(limit)
    trips = session.exec(statement).unique().all()
    # Convert to dictionaries to break the ORM relationship chain
    trip_dicts = [
        {
            "id": trip.id,
            "mission_id": trip.mission_id,
            "type": trip.type,
            "active": trip.active,
            "check_in_time": trip.check_in_time,
            "boarding_time": trip.boarding_time,
            "departure_time": trip.departure_time,
            "created_at": trip.created_at,
            "updated_at": trip.updated_at,
        }
        for trip in trips
    ]
    return trip_dicts


def get_trips_count(*, session: Session) -> int:
    """Get total count of trips."""
    statement = select(func.count()).select_from(Trip)
    return session.exec(statement).one()


def get_trips_by_mission(
    *, session: Session, mission_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[Trip]:
    """Get trips for a specific mission."""
    statement = (
        select(Trip)
        .where(Trip.mission_id == mission_id)
        .order_by(Trip.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return session.exec(statement).unique().all()


def create_trip(*, session: Session, trip_in: TripCreate) -> Trip:
    """Create a new trip."""
    trip = Trip.model_validate(trip_in)
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip


def update_trip(*, session: Session, db_obj: Trip, obj_in: TripUpdate) -> Trip:
    """Update a trip."""
    # Convert model to dict, excluding any None values
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip(*, session: Session, trip_id: uuid.UUID) -> Trip:
    """Delete a trip."""
    trip = get_trip(session=session, trip_id=trip_id)
    if not trip:
        return None
    session.delete(trip)
    session.commit()
    return trip


# TripBoat CRUD
def get_trip_boat(*, session: Session, trip_boat_id: uuid.UUID) -> TripBoat | None:
    """Get trip_boat by ID."""
    return session.get(TripBoat, trip_boat_id)


def get_trip_boats_by_trip(
    *, session: Session, trip_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats for a specific trip."""
    statement = (
        select(TripBoat).where(TripBoat.trip_id == trip_id).offset(skip).limit(limit)
    )
    return session.exec(statement).all()


def get_trip_boats_by_boat(
    *, session: Session, boat_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[TripBoat]:
    """Get trip boats for a specific boat."""
    statement = (
        select(TripBoat).where(TripBoat.boat_id == boat_id).offset(skip).limit(limit)
    )
    return session.exec(statement).all()


def create_trip_boat(*, session: Session, trip_boat_in: TripBoatCreate) -> TripBoat:
    """Create a new trip boat association."""
    trip_boat = TripBoat.model_validate(trip_boat_in)
    session.add(trip_boat)
    session.commit()
    session.refresh(trip_boat)
    return trip_boat


def update_trip_boat(
    *, session: Session, db_obj: TripBoat, obj_in: TripBoatUpdate
) -> TripBoat:
    """Update a trip boat association."""
    # Convert model to dict, excluding any None values
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def delete_trip_boat(*, session: Session, trip_boat_id: uuid.UUID) -> TripBoat:
    """Delete a trip boat association."""
    trip_boat = get_trip_boat(session=session, trip_boat_id=trip_boat_id)
    if not trip_boat:
        return None
    session.delete(trip_boat)
    session.commit()
    return trip_boat
