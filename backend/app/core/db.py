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
    MerchandiseVariationCreate,
    Mission,
    MissionCreate,
    Provider,
    ProviderCreate,
    Trip,
    TripBase,
    TripBoat,
    TripBoatCreate,
    TripBoatPricingCreate,
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

    # Second provider (Space Coast Charters)
    second_provider = session.exec(
        select(Provider).where(Provider.name == "Space Coast Charters")
    ).first()
    if not second_provider:
        second_provider_in = ProviderCreate(
            name="Space Coast Charters",
            location="Port Canaveral",
            address="500 Marina Way, Port Canaveral, FL 32920",
            jurisdiction_id=jurisdiction.id,
            map_link="https://maps.example.com/space-coast",
        )
        second_provider = crud.create_provider(
            session=session, provider_in=second_provider_in
        )
    print(f"Second provider created: {second_provider}")

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

    # Launches Beta and Gamma
    launch_beta = session.exec(
        select(Launch).where(Launch.name == "Launch Beta")
    ).first()
    if not launch_beta:
        launch_beta = crud.create_launch(
            session=session,
            launch_in=LaunchCreate(
                name="Launch Beta",
                launch_timestamp=datetime.now(timezone.utc) + timedelta(days=45),
                summary="Second seed launch",
                location_id=location.id,
            ),
        )
    launch_gamma = session.exec(
        select(Launch).where(Launch.name == "Launch Gamma")
    ).first()
    if not launch_gamma:
        launch_gamma = crud.create_launch(
            session=session,
            launch_in=LaunchCreate(
                name="Launch Gamma",
                launch_timestamp=datetime.now(timezone.utc) + timedelta(days=60),
                summary="Third seed launch",
                location_id=location.id,
            ),
        )
    print(f"Launches Beta/Gamma created: {launch_beta}, {launch_gamma}")

    # Missions Beta and Gamma
    mission_beta = session.exec(
        select(Mission).where(Mission.name == "Mission Beta")
    ).first()
    if not mission_beta:
        mission_beta = crud.create_mission(
            session=session,
            mission_in=MissionCreate(
                name="Mission Beta",
                launch_id=launch_beta.id,
                active=True,
                refund_cutoff_hours=12,
            ),
        )
    mission_gamma = session.exec(
        select(Mission).where(Mission.name == "Mission Gamma")
    ).first()
    if not mission_gamma:
        mission_gamma = crud.create_mission(
            session=session,
            mission_in=MissionCreate(
                name="Mission Gamma",
                launch_id=launch_gamma.id,
                active=True,
                refund_cutoff_hours=24,
            ),
        )
    print(f"Missions Beta/Gamma created: {mission_beta}, {mission_gamma}")

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

    # Voyager II (same provider), two ticket types
    boat_voyager = session.exec(select(Boat).where(Boat.name == "Voyager II")).first()
    if not boat_voyager:
        boat_voyager = crud.create_boat(
            session=session,
            boat_in=BoatCreate(
                name="Voyager II",
                capacity=80,
                provider_id=provider.id,
            ),
        )
        for bp in (
            BoatPricingCreate(
                boat_id=boat_voyager.id,
                ticket_type="adult",
                price=4500,
                capacity=60,
            ),
            BoatPricingCreate(
                boat_id=boat_voyager.id,
                ticket_type="child",
                price=2500,
                capacity=20,
            ),
        ):
            crud.create_boat_pricing(session=session, boat_pricing_in=bp)
    print(f"Boat Voyager II created: {boat_voyager}")

    # Stargazer (second provider), three ticket types
    boat_stargazer = session.exec(select(Boat).where(Boat.name == "Stargazer")).first()
    if not boat_stargazer:
        boat_stargazer = crud.create_boat(
            session=session,
            boat_in=BoatCreate(
                name="Stargazer",
                capacity=60,
                provider_id=second_provider.id,
            ),
        )
        for bp in (
            BoatPricingCreate(
                boat_id=boat_stargazer.id,
                ticket_type="adult",
                price=6000,
                capacity=40,
            ),
            BoatPricingCreate(
                boat_id=boat_stargazer.id,
                ticket_type="child",
                price=3500,
                capacity=12,
            ),
            BoatPricingCreate(
                boat_id=boat_stargazer.id,
                ticket_type="vip",
                price=12000,
                capacity=8,
            ),
        ):
            crud.create_boat_pricing(session=session, boat_pricing_in=bp)
    print(f"Boat Stargazer created: {boat_stargazer}")

    # Trip 2: same mission as Trip 1, Voyager II only (adult + child)
    trip2 = session.exec(select(Trip).where(Trip.name == "Trip Voyager")).first()
    if not trip2:
        launch_time_1 = launch.launch_timestamp
        dep_1 = launch_time_1 - timedelta(hours=1)
        board_1 = dep_1 - timedelta(minutes=30)
        check_1 = board_1 - timedelta(minutes=30)
        trip2_in = TripBase(
            mission_id=mission.id,
            name="Trip Voyager",
            type="launch_viewing",
            active=True,
            booking_mode="public",
            sales_open_at=launch_time_1 - timedelta(days=7),
            check_in_time=check_1,
            boarding_time=board_1,
            departure_time=dep_1,
        )
        trip2 = crud.create_trip(session=session, trip_in=trip2_in)
        crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=trip2.id,
                boat_id=boat_voyager.id,
                max_capacity=80,
            ),
        )
    print(f"Trip 2 (Voyager II) created: {trip2}")

    # Trip 3: Mission Beta, Stargazer, custom pricing only
    trip3 = session.exec(
        select(Trip).where(Trip.name == "Trip Stargazer Custom")
    ).first()
    if not trip3:
        launch_time_beta = launch_beta.launch_timestamp
        dep_beta = launch_time_beta - timedelta(hours=1)
        board_beta = dep_beta - timedelta(minutes=30)
        check_beta = board_beta - timedelta(minutes=30)
        trip3_in = TripBase(
            mission_id=mission_beta.id,
            name="Trip Stargazer Custom",
            type="launch_viewing",
            active=True,
            booking_mode="public",
            sales_open_at=launch_time_beta - timedelta(days=7),
            check_in_time=check_beta,
            boarding_time=board_beta,
            departure_time=dep_beta,
        )
        trip3 = crud.create_trip(session=session, trip_in=trip3_in)
        trip3_boat = crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=trip3.id,
                boat_id=boat_stargazer.id,
                max_capacity=60,
                use_only_trip_pricing=True,
                sales_enabled=True,
            ),
        )
        for tbp in (
            TripBoatPricingCreate(
                trip_boat_id=trip3_boat.id,
                ticket_type="adult",
                price=5500,
                capacity=35,
            ),
            TripBoatPricingCreate(
                trip_boat_id=trip3_boat.id,
                ticket_type="child",
                price=3000,
                capacity=15,
            ),
            TripBoatPricingCreate(
                trip_boat_id=trip3_boat.id,
                ticket_type="vip",
                price=10000,
                capacity=10,
            ),
        ):
            crud.create_trip_boat_pricing(session=session, trip_boat_pricing_in=tbp)
    print(f"Trip 3 (Stargazer custom pricing) created: {trip3}")

    # Trip 4: same mission as Trip 1, two boats (Boaty + Voyager II)
    trip4 = session.exec(select(Trip).where(Trip.name == "Trip Dual Boat")).first()
    if not trip4:
        launch_time_4 = launch.launch_timestamp
        dep_4 = launch_time_4 - timedelta(hours=2)
        board_4 = dep_4 - timedelta(minutes=30)
        check_4 = board_4 - timedelta(minutes=30)
        trip4_in = TripBase(
            mission_id=mission.id,
            name="Trip Dual Boat",
            type="launch_viewing",
            active=True,
            booking_mode="public",
            sales_open_at=launch_time_4 - timedelta(days=7),
            check_in_time=check_4,
            boarding_time=board_4,
            departure_time=dep_4,
        )
        trip4 = crud.create_trip(session=session, trip_in=trip4_in)
        crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=trip4.id,
                boat_id=boat.id,
                max_capacity=100,
            ),
        )
        crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=trip4.id,
                boat_id=boat_voyager.id,
                max_capacity=80,
            ),
        )
    print(f"Trip 4 (dual boat) created: {trip4}")

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

    # Cap (simple merch)
    merch_cap = session.exec(
        select(Merchandise).where(Merchandise.name == "Seed Cap")
    ).first()
    if not merch_cap:
        merch_cap = crud.create_merchandise(
            session=session,
            merchandise_in=MerchandiseCreate(
                name="Seed Cap",
                description="Seed merchandise cap",
                price=1500,
                quantity_available=100,
            ),
        )
    print(f"Merchandise Cap created: {merch_cap}")

    # Hoodie with variations (S, M, L)
    merch_hoodie = session.exec(
        select(Merchandise).where(Merchandise.name == "Seed Hoodie")
    ).first()
    if not merch_hoodie:
        merch_hoodie = crud.create_merchandise(
            session=session,
            merchandise_in=MerchandiseCreate(
                name="Seed Hoodie",
                description="Seed hoodie with size variants",
                price=5500,
                quantity_available=0,
            ),
        )
        for variant_value in ("S", "M", "L"):
            crud.create_merchandise_variation(
                session=session,
                variation_in=MerchandiseVariationCreate(
                    merchandise_id=merch_hoodie.id,
                    variant_value=variant_value,
                    quantity_total=20,
                    quantity_sold=0,
                    quantity_fulfilled=0,
                ),
            )
    print(f"Merchandise Hoodie (with variations) created: {merch_hoodie}")

    # Seed booking if none exist
    if not session.exec(select(Booking).limit(1)).first():
        # Resolve trip refs from DB so they stay valid across commits
        _trip2_seed = session.exec(
            select(Trip).where(Trip.name == "Trip Voyager")
        ).first()
        _trip4_seed = session.exec(
            select(Trip).where(Trip.name == "Trip Dual Boat")
        ).first()
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

        # SEED0002: child tickets on Trip 2 (Voyager II)
        subtotal2 = 2500 * 2
        tax2 = int(subtotal2 * 0.06)
        booking2 = Booking(
            confirmation_code="SEED0002",
            first_name="Alice",
            last_name="Smith",
            user_email="alice@example.com",
            user_phone="+15559876543",
            billing_address="100 Kid St, Test City, FL 32000",
            subtotal=subtotal2,
            discount_amount=0,
            tax_amount=tax2,
            tip_amount=0,
            total_amount=subtotal2 + tax2,
            payment_status=PaymentStatus.paid,
            booking_status=BookingStatus.confirmed,
        )
        session.add(booking2)
        session.commit()
        session.refresh(booking2)
        if not _trip2_seed:
            raise RuntimeError("Seed Trip Voyager not found for SEED0002")
        session.add(
            BookingItem(
                booking_id=booking2.id,
                trip_id=_trip2_seed.id,
                boat_id=boat_voyager.id,
                item_type="child",
                quantity=2,
                price_per_unit=2500,
                status=BookingItemStatus.active,
            )
        )
        session.commit()
        print("Seed booking SEED0002 created")

        # SEED0003: mixed adult + child on Trip 2 (Voyager II)
        if not _trip2_seed:
            raise RuntimeError("Seed Trip Voyager not found for SEED0003")
        subtotal3 = 4500 + 2500
        tax3 = int(subtotal3 * 0.06)
        booking3 = Booking(
            confirmation_code="SEED0003",
            first_name="Bob",
            last_name="Jones",
            user_email="bob@example.com",
            user_phone="+15555555555",
            billing_address="200 Family Ave, Test City, FL 32000",
            subtotal=subtotal3,
            discount_amount=0,
            tax_amount=tax3,
            tip_amount=0,
            total_amount=subtotal3 + tax3,
            payment_status=PaymentStatus.paid,
            booking_status=BookingStatus.confirmed,
        )
        session.add(booking3)
        session.commit()
        session.refresh(booking3)
        for bi in (
            BookingItem(
                booking_id=booking3.id,
                trip_id=_trip2_seed.id,
                boat_id=boat_voyager.id,
                item_type="adult",
                quantity=1,
                price_per_unit=4500,
                status=BookingItemStatus.active,
            ),
            BookingItem(
                booking_id=booking3.id,
                trip_id=_trip2_seed.id,
                boat_id=boat_voyager.id,
                item_type="child",
                quantity=1,
                price_per_unit=2500,
                status=BookingItemStatus.active,
            ),
        ):
            session.add(bi)
        session.commit()
        print("Seed booking SEED0003 created")

        # SEED0004: Trip 4, two boats (1 adult on Boaty, 1 adult on Voyager II)
        if not _trip4_seed:
            raise RuntimeError("Seed Trip Dual Boat not found for SEED0004")
        subtotal4 = 5000 + 4500
        tax4 = int(subtotal4 * 0.06)
        booking4 = Booking(
            confirmation_code="SEED0004",
            first_name="Carol",
            last_name="Lee",
            user_email="carol@example.com",
            user_phone="+15553334444",
            billing_address="300 Multi St, Test City, FL 32000",
            subtotal=subtotal4,
            discount_amount=0,
            tax_amount=tax4,
            tip_amount=0,
            total_amount=subtotal4 + tax4,
            payment_status=PaymentStatus.paid,
            booking_status=BookingStatus.confirmed,
        )
        session.add(booking4)
        session.commit()
        session.refresh(booking4)
        for bi in (
            BookingItem(
                booking_id=booking4.id,
                trip_id=_trip4_seed.id,
                boat_id=boat.id,
                item_type="adult",
                quantity=1,
                price_per_unit=5000,
                status=BookingItemStatus.active,
            ),
            BookingItem(
                booking_id=booking4.id,
                trip_id=_trip4_seed.id,
                boat_id=boat_voyager.id,
                item_type="adult",
                quantity=1,
                price_per_unit=4500,
                status=BookingItemStatus.active,
            ),
        ):
            session.add(bi)
        session.commit()
        print("Seed booking SEED0004 created")
