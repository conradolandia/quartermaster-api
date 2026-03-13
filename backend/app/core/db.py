from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

from app import crud
from app.core.config import settings
from app.models import (
    Boat,
    BoatCreate,
    BoatPricing,
    BoatPricingCreate,
    Booking,
    BookingItem,
    DiscountCode,
    Jurisdiction,
    JurisdictionCreate,
    Launch,
    LaunchCreate,
    Location,
    LocationCreate,
    Merchandise,
    MerchandiseCreate,
    Mission,
    MissionCreate,
    Provider,
    ProviderCreate,
    Trip,
    TripBase,
    TripBoat,
    TripBoatCreate,
    User,
    UserCreate,
)
from app.models.enums import (
    BookingItemStatus,
    BookingStatus,
    DiscountCodeType,
    PaymentStatus,
)

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Create tables directly
    SQLModel.metadata.create_all(engine)

    # Add qr_code_base64 column to booking table if it doesn't exist
    try:
        with engine.connect() as conn:
            conn.execute(
                text("ALTER TABLE booking ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT")
            )
            conn.commit()
            print("Added qr_code_base64 column to booking table if it didn't exist")
    except Exception as e:
        print(f"Error adding qr_code_base64 column: {e}")

    if not settings.RUN_INITIAL_DATA:
        print("RUN_INITIAL_DATA is not set; skipping initial data")
        return

    if session.exec(select(User).limit(1)).first():
        print("Database already has users; skipping initial data")
        return

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
        try:
            user = crud.create_user(session=session, user_create=user_in)
        except IntegrityError:
            session.rollback()
            # Another initializer (tests or pre-start) may have created this user
            user = crud.get_user_by_email(
                session=session, email=settings.FIRST_SUPERUSER
            )
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

    # Create default provider if it doesn't exist
    provider = session.exec(
        select(Provider).where(Provider.name == "Default Provider")
    ).first()
    if not provider:
        provider_in = ProviderCreate(
            name="Default Provider",
            location="Cape Canaveral",
            address="123 Main St, Cape Canaveral, FL 32920",
            jurisdiction_id=jurisdiction.id,
            map_link="https://maps.example.com/boaty",
        )
        provider = crud.create_provider(session=session, provider_in=provider_in)
    print(f"Provider created: {provider}")

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
        mission_in = MissionCreate(
            name="Default Mission",
            launch_id=launch.id,
            active=True,
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
            provider_id=provider.id,
        )
        boat = crud.create_boat(session=session, boat_in=boat_in)
    print(f"Boat created: {boat}")

    # Create default trip if it doesn't exist
    trip = session.exec(
        select(Trip).where(Trip.mission_id == mission.id, Trip.type == "launch_viewing")
    ).first()
    if not trip:
        # Departure 1h before launch; boarding 30 min before departure; check-in 30 min before boarding
        launch_time = launch.launch_timestamp
        departure_time = launch_time - timedelta(hours=1)
        boarding_time = departure_time - timedelta(minutes=30)
        check_in_time = boarding_time - timedelta(minutes=30)

        sales_open_at = launch_time - timedelta(days=7)
        trip_in = TripBase(
            mission_id=mission.id,
            name=None,
            type="launch_viewing",
            active=True,
            booking_mode="public",
            sales_open_at=sales_open_at,
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

    # Default boat pricing (seats per ticket type) if none exist for this boat
    if not session.exec(
        select(BoatPricing).where(BoatPricing.boat_id == boat.id).limit(1)
    ).first():
        bp_in = BoatPricingCreate(
            boat_id=boat.id,
            ticket_type="adult",
            price=5000,
            capacity=100,
        )
        crud.create_boat_pricing(session=session, boat_pricing_in=bp_in)
        print("Boat pricing (adult) created for default boat")

    # Default discount code if none exist
    if not session.exec(
        select(DiscountCode).where(DiscountCode.code == "WELCOME10").limit(1)
    ).first():
        discount = DiscountCode(
            code="WELCOME10",
            description="10% off (seed)",
            discount_type=DiscountCodeType.percentage,
            discount_value=0.10,
            is_active=True,
        )
        session.add(discount)
        session.commit()
        print("Discount code WELCOME10 created")

    # Default merchandise if none exist
    if not session.exec(select(Merchandise).limit(1)).first():
        merch_in = MerchandiseCreate(
            name="Default T-Shirt",
            description="Seed merchandise item",
            price=2500,
            quantity_available=50,
        )
        crud.create_merchandise(session=session, merchandise_in=merch_in)
        print("Merchandise (Default T-Shirt) created")

    # Seed booking if none exist
    if not session.exec(select(Booking).limit(1)).first():
        confirmation_code = "SEED0001"
        price_cents = 5000
        qty = 2
        subtotal = price_cents * qty
        tax = int(subtotal * 0.06)
        total = subtotal + tax
        booking = Booking(
            confirmation_code=confirmation_code,
            first_name="Jane",
            last_name="Doe",
            user_email="jane.doe@example.com",
            user_phone="+15551234567",
            billing_address="456 Seed St, Test City, FL 32000",
            subtotal=subtotal,
            discount_amount=0,
            tax_amount=tax,
            tip_amount=0,
            total_amount=total,
            payment_status=PaymentStatus.paid,
            booking_status=BookingStatus.confirmed,
        )
        session.add(booking)
        session.commit()
        session.refresh(booking)
        item = BookingItem(
            booking_id=booking.id,
            trip_id=trip.id,
            boat_id=boat.id,
            item_type="adult",
            quantity=qty,
            price_per_unit=price_cents,
            status=BookingItemStatus.active,
        )
        session.add(item)
        session.commit()
        print("Seed booking SEED0001 created")
