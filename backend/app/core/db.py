from datetime import datetime, timedelta, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app import crud
from app.core.config import settings
from app.models import (
    Boat,
    BoatCreate,
    Jurisdiction,
    JurisdictionCreate,
    Launch,
    LaunchCreate,
    Location,
    LocationCreate,
    Mission,
    MissionCreate,
    Trip,
    TripBoat,
    TripBoatCreate,
    TripCreate,
    User,
    UserCreate,
)

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Create tables directly
    SQLModel.metadata.create_all(engine)

    # This function also creates initial data if it doesn't exist
    # Create user if it doesn't exist
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)
    print(f"User created: {user}")

    # Create location if it doesn't exist
    location = session.exec(
        select(Location).where(Location.name == "Default Location")
    ).first()
    if not location:
        location_in = LocationCreate(
            name="Default Location",
            state="FL",
        )
        location = crud.create_location(session=session, location_in=location_in)
    print(f"Location created: {location}")

    # Create jurisdiction if it doesn't exist
    jurisdiction = session.exec(
        select(Jurisdiction).where(Jurisdiction.name == "Default Jurisdiction")
    ).first()
    if not jurisdiction:
        jurisdiction_in = JurisdictionCreate(
            name="Default Jurisdiction",
            state="FL",
            sales_tax_rate=0.06,
            location_id=location.id,
        )
        jurisdiction = crud.create_jurisdiction(
            session=session, jurisdiction_in=jurisdiction_in
        )
    print(f"Jurisdiction created: {jurisdiction}")

    # Create default launch if it doesn't exist
    launch = session.exec(select(Launch).where(Launch.name == "Default Launch")).first()
    if not launch:
        # Create a launch scheduled for 30 days from now
        future_date = datetime.now(timezone.utc) + timedelta(days=30)

        launch_in = LaunchCreate(
            name="Default Launch",
            launch_timestamp=future_date,
            summary="This is a default launch created during initial setup",
            location_id=location.id,
        )
        launch = crud.create_launch(session=session, launch_in=launch_in)
    print(f"Launch created: {launch}")

    # Create default mission if it doesn't exist
    mission = session.exec(
        select(Mission).where(Mission.name == "Default Mission")
    ).first()
    if not mission:
        # Create a mission with sales opening 7 days before launch
        sales_open_date = launch.launch_timestamp - timedelta(days=7)

        mission_in = MissionCreate(
            name="Default Mission",
            launch_id=launch.id,
            active=True,
            public=True,
            sales_open_at=sales_open_date,
            refund_cutoff_hours=12,
        )
        mission = crud.create_mission(session=session, mission_in=mission_in)
    print(f"Mission created: {mission}")

    # Create default boat if it doesn't exist
    boat = session.exec(select(Boat).where(Boat.name == "Boaty McBoatface")).first()
    if not boat:
        boat_in = BoatCreate(
            name="Boaty McBoatface",
            capacity=150,
            provider_name="Default Provider",
            provider_location="Cape Canaveral",
            provider_address="123 Main St, Cape Canaveral, FL 32920",
            jurisdiction_id=jurisdiction.id,
            map_link="https://maps.example.com/boaty",
        )
        boat = crud.create_boat(session=session, boat_in=boat_in)
    print(f"Boat created: {boat}")

    # Create default trip if it doesn't exist
    trip = session.exec(
        select(Trip).where(Trip.mission_id == mission.id, Trip.type == "launch_viewing")
    ).first()
    if not trip:
        # Create times based on the launch time
        launch_time = launch.launch_timestamp
        check_in_time = launch_time - timedelta(hours=3)
        boarding_time = launch_time - timedelta(hours=2, minutes=30)
        departure_time = launch_time - timedelta(hours=2)

        trip_in = TripCreate(
            mission_id=mission.id,
            type="launch_viewing",
            active=True,
            check_in_time=check_in_time,
            boarding_time=boarding_time,
            departure_time=departure_time,
        )
        trip = crud.create_trip(session=session, trip_in=trip_in)
    print(f"Trip created: {trip}")

    # Create default trip-boat association if it doesn't exist
    trip_boat = session.exec(
        select(TripBoat).where(TripBoat.trip_id == trip.id, TripBoat.boat_id == boat.id)
    ).first()
    if not trip_boat:
        trip_boat_in = TripBoatCreate(
            trip_id=trip.id,
            boat_id=boat.id,
            max_capacity=120,  # Optional override of default capacity
        )
        trip_boat = crud.create_trip_boat(session=session, trip_boat_in=trip_boat_in)
    print(f"Trip-Boat association created: {trip_boat}")
