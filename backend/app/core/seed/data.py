"""
Initial seed data for development and testing.

Creates user, location, jurisdiction, providers, boats, launches, missions,
trips, merchandise, discount codes, and sample bookings when the database
is empty and RUN_INITIAL_DATA is enabled. Call only after bootstrap_schema.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

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


def run_seed_data(session: Session) -> None:
    """
    Insert initial seed data. Assumes RUN_INITIAL_DATA is True and no users exist.
    """
    # User
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
            user = crud.get_user_by_email(
                session=session, email=settings.FIRST_SUPERUSER
            )
    print(f"User created: {user}")

    # Location and jurisdiction
    location = session.exec(
        select(Location).where(Location.name == "Default Location")
    ).first()
    if not location:
        location = crud.create_location(
            session=session,
            location_in=LocationCreate(name="Default Location", state="FL"),
        )
    print(f"Location created: {location}")

    jurisdiction = session.exec(
        select(Jurisdiction).where(Jurisdiction.name == "Default Jurisdiction")
    ).first()
    if not jurisdiction:
        jurisdiction = crud.create_jurisdiction(
            session=session,
            jurisdiction_in=JurisdictionCreate(
                name="Default Jurisdiction",
                state="FL",
                sales_tax_rate=0.06,
                location_id=location.id,
            ),
        )
    print(f"Jurisdiction created: {jurisdiction}")

    # Providers
    provider = session.exec(
        select(Provider).where(Provider.name == "Default Provider")
    ).first()
    if not provider:
        provider = crud.create_provider(
            session=session,
            provider_in=ProviderCreate(
                name="Default Provider",
                location="Cape Canaveral",
                address="123 Main St, Cape Canaveral, FL 32920",
                jurisdiction_id=jurisdiction.id,
                map_link="https://maps.example.com/boaty",
            ),
        )
    print(f"Provider created: {provider}")

    second_provider = session.exec(
        select(Provider).where(Provider.name == "Space Coast Charters")
    ).first()
    if not second_provider:
        second_provider = crud.create_provider(
            session=session,
            provider_in=ProviderCreate(
                name="Space Coast Charters",
                location="Port Canaveral",
                address="500 Marina Way, Port Canaveral, FL 32920",
                jurisdiction_id=jurisdiction.id,
                map_link="https://maps.example.com/space-coast",
            ),
        )
    print(f"Second provider created: {second_provider}")

    # Launches and missions
    launch = session.exec(select(Launch).where(Launch.name == "Default Launch")).first()
    if not launch:
        launch = crud.create_launch(
            session=session,
            launch_in=LaunchCreate(
                name="Default Launch",
                launch_timestamp=datetime.now(timezone.utc) + timedelta(days=30),
                summary="This is a default launch created during initial setup",
                location_id=location.id,
            ),
        )
    print(f"Launch created: {launch}")

    mission = session.exec(
        select(Mission).where(Mission.name == "Default Mission")
    ).first()
    if not mission:
        mission = crud.create_mission(
            session=session,
            mission_in=MissionCreate(
                name="Default Mission",
                launch_id=launch.id,
                active=True,
                refund_cutoff_hours=12,
            ),
        )
    print(f"Mission created: {mission}")

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

    # Boats and pricing
    boat = session.exec(select(Boat).where(Boat.name == "Boaty McBoatface")).first()
    if not boat:
        boat = crud.create_boat(
            session=session,
            boat_in=BoatCreate(
                name="Boaty McBoatface",
                capacity=150,
                provider_id=provider.id,
            ),
        )
    print(f"Boat created: {boat}")

    trip = session.exec(
        select(Trip).where(Trip.mission_id == mission.id, Trip.type == "launch_viewing")
    ).first()
    if not trip:
        launch_time = launch.launch_timestamp
        dep = launch_time - timedelta(hours=1)
        board = dep - timedelta(minutes=30)
        check = board - timedelta(minutes=30)
        trip = crud.create_trip(
            session=session,
            trip_in=TripBase(
                mission_id=mission.id,
                name=None,
                type="launch_viewing",
                active=True,
                booking_mode="public",
                sales_open_at=launch_time - timedelta(days=7),
                check_in_time=check,
                boarding_time=board,
                departure_time=dep,
            ),
        )
    print(f"Trip created: {trip}")

    trip_boat = session.exec(
        select(TripBoat).where(TripBoat.trip_id == trip.id, TripBoat.boat_id == boat.id)
    ).first()
    if not trip_boat:
        trip_boat = crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=trip.id,
                boat_id=boat.id,
                max_capacity=120,
            ),
        )
    print(f"Trip-Boat association created: {trip_boat}")

    if not session.exec(
        select(BoatPricing).where(BoatPricing.boat_id == boat.id).limit(1)
    ).first():
        crud.create_boat_pricing(
            session=session,
            boat_pricing_in=BoatPricingCreate(
                boat_id=boat.id,
                ticket_type="adult",
                price=5000,
                capacity=100,
            ),
        )
        print("Boat pricing (adult) created for default boat")

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

    # Trips 2, 3, 4
    trip2 = session.exec(select(Trip).where(Trip.name == "Trip Voyager")).first()
    if not trip2:
        lt1 = launch.launch_timestamp
        dep1 = lt1 - timedelta(hours=1)
        board1 = dep1 - timedelta(minutes=30)
        check1 = board1 - timedelta(minutes=30)
        trip2 = crud.create_trip(
            session=session,
            trip_in=TripBase(
                mission_id=mission.id,
                name="Trip Voyager",
                type="launch_viewing",
                active=True,
                booking_mode="public",
                sales_open_at=lt1 - timedelta(days=7),
                check_in_time=check1,
                boarding_time=board1,
                departure_time=dep1,
            ),
        )
        crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=trip2.id,
                boat_id=boat_voyager.id,
                max_capacity=80,
            ),
        )
    print(f"Trip 2 (Voyager II) created: {trip2}")

    trip3 = session.exec(
        select(Trip).where(Trip.name == "Trip Stargazer Custom")
    ).first()
    if not trip3:
        lt_beta = launch_beta.launch_timestamp
        dep_beta = lt_beta - timedelta(hours=1)
        board_beta = dep_beta - timedelta(minutes=30)
        check_beta = board_beta - timedelta(minutes=30)
        trip3 = crud.create_trip(
            session=session,
            trip_in=TripBase(
                mission_id=mission_beta.id,
                name="Trip Stargazer Custom",
                type="launch_viewing",
                active=True,
                booking_mode="public",
                sales_open_at=lt_beta - timedelta(days=7),
                check_in_time=check_beta,
                boarding_time=board_beta,
                departure_time=dep_beta,
            ),
        )
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

    trip4 = session.exec(select(Trip).where(Trip.name == "Trip Dual Boat")).first()
    if not trip4:
        lt4 = launch.launch_timestamp
        dep4 = lt4 - timedelta(hours=2)
        board4 = dep4 - timedelta(minutes=30)
        check4 = board4 - timedelta(minutes=30)
        trip4 = crud.create_trip(
            session=session,
            trip_in=TripBase(
                mission_id=mission.id,
                name="Trip Dual Boat",
                type="launch_viewing",
                active=True,
                booking_mode="public",
                sales_open_at=lt4 - timedelta(days=7),
                check_in_time=check4,
                boarding_time=board4,
                departure_time=dep4,
            ),
        )
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

    # Discount and merchandise
    if not session.exec(
        select(DiscountCode).where(DiscountCode.code == "WELCOME10").limit(1)
    ).first():
        session.add(
            DiscountCode(
                code="WELCOME10",
                description="10% off (seed)",
                discount_type=DiscountCodeType.percentage,
                discount_value=0.10,
                is_active=True,
            )
        )
        session.commit()
        print("Discount code WELCOME10 created")

    if not session.exec(select(Merchandise).limit(1)).first():
        crud.create_merchandise(
            session=session,
            merchandise_in=MerchandiseCreate(
                name="Default T-Shirt",
                description="Seed merchandise item",
                price=2500,
                quantity_available=50,
            ),
        )
        print("Merchandise (Default T-Shirt) created")

    merch_cap = session.exec(
        select(Merchandise).where(Merchandise.name == "Seed Cap")
    ).first()
    if not merch_cap:
        crud.create_merchandise(
            session=session,
            merchandise_in=MerchandiseCreate(
                name="Seed Cap",
                description="Seed merchandise cap",
                price=1500,
                quantity_available=100,
            ),
        )
    print("Merchandise Cap created")

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
        for v in ("S", "M", "L"):
            crud.create_merchandise_variation(
                session=session,
                variation_in=MerchandiseVariationCreate(
                    merchandise_id=merch_hoodie.id,
                    variant_value=v,
                    quantity_total=20,
                    quantity_sold=0,
                    quantity_fulfilled=0,
                ),
            )
    print("Merchandise Hoodie (with variations) created")

    # Seed bookings
    if not session.exec(select(Booking).limit(1)).first():
        _trip2_seed = session.exec(
            select(Trip).where(Trip.name == "Trip Voyager")
        ).first()
        _trip4_seed = session.exec(
            select(Trip).where(Trip.name == "Trip Dual Boat")
        ).first()

        # SEED0001
        subtotal1 = 5000 * 2
        tax1 = int(subtotal1 * 0.06)
        booking1 = Booking(
            confirmation_code="SEED0001",
            first_name="Jane",
            last_name="Doe",
            user_email="jane.doe@example.com",
            user_phone="+15551234567",
            billing_address="456 Seed St, Test City, FL 32000",
            subtotal=subtotal1,
            discount_amount=0,
            tax_amount=tax1,
            tip_amount=0,
            total_amount=subtotal1 + tax1,
            payment_status=PaymentStatus.paid,
            booking_status=BookingStatus.confirmed,
        )
        session.add(booking1)
        session.commit()
        session.refresh(booking1)
        session.add(
            BookingItem(
                booking_id=booking1.id,
                trip_id=trip.id,
                boat_id=boat.id,
                item_type="adult",
                quantity=2,
                price_per_unit=5000,
                status=BookingItemStatus.active,
            )
        )
        session.commit()
        print("Seed booking SEED0001 created")

        # SEED0002
        if not _trip2_seed:
            raise RuntimeError("Seed Trip Voyager not found for SEED0002")
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

        # SEED0003
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

        # SEED0004
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
