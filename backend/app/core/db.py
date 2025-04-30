from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine, inspect, select

from app import crud
from app.core.config import settings
from app.models import (
    Jurisdiction,
    JurisdictionCreate,
    Location,
    LocationCreate,
    User,
    UserCreate,
)

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    # Check if required tables exist
    inspector = inspect(engine)
    required_tables = ["location", "jurisdiction", "user", "item"]
    existing_tables = inspector.get_table_names()

    # Create tables if any required table is missing
    missing_tables = [
        table for table in required_tables if table not in existing_tables
    ]
    if missing_tables:
        SQLModel.metadata.create_all(engine)
        print(f"Created missing tables: {missing_tables}")

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
            slug="default-location",
            state="FL",
            id=str(uuid4()),
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
            slug="default-jurisdiction",
            state="FL",
            sales_tax_rate=0.06,
            location_id=location.id,
            id=str(uuid4()),
        )
        jurisdiction = crud.create_jurisdiction(
            session=session, jurisdiction_in=jurisdiction_in
        )
    print(f"Jurisdiction created: {jurisdiction}")
