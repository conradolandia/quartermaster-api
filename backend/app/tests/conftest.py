from collections.abc import Generator
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.api.deps import get_db
from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    DiscountCode,
    Jurisdiction,
    Launch,
    Location,
    Merchandise,
    MerchandiseVariation,
    Mission,
    PaymentStatus,
    Provider,
    Trip,
    TripBoat,
    TripBoatPricing,
    TripMerchandise,
    User,
)
from app.models.enums import DiscountCodeType
from app.tests.utils.user import authentication_token_from_email
from app.tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        try:
            # Clean up any existing test data first to ensure isolation
            session.rollback()
            # Delete in reverse dependency order
            session.exec(delete(BookingItem))  # type: ignore[call-overload]
            session.exec(delete(Booking))  # type: ignore[call-overload]
            session.exec(delete(DiscountCode))  # type: ignore[call-overload]
            session.exec(delete(TripMerchandise))  # type: ignore[call-overload]
            session.exec(delete(MerchandiseVariation))  # type: ignore[call-overload]
            session.exec(delete(Merchandise))  # type: ignore[call-overload]
            session.exec(delete(TripBoatPricing))  # type: ignore[call-overload]
            session.exec(delete(TripBoat))  # type: ignore[call-overload]
            session.exec(delete(BoatPricing))  # type: ignore[call-overload]
            session.exec(delete(Boat))  # type: ignore[call-overload]
            session.exec(delete(Trip))  # type: ignore[call-overload]
            session.exec(delete(Mission))  # type: ignore[call-overload]
            session.exec(delete(Launch))  # type: ignore[call-overload]
            session.exec(delete(Provider))  # type: ignore[call-overload]
            session.exec(delete(Jurisdiction))  # type: ignore[call-overload]
            session.exec(delete(Location))  # type: ignore[call-overload]
            session.exec(delete(User))  # type: ignore[call-overload]
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error during initial test cleanup: {e}")

        # Run database init and commit so app requests see the data
        init_db(session)
        session.commit()
        yield session

        # Clean up test data
        try:
            session.rollback()
            session.exec(delete(BookingItem))  # type: ignore[call-overload]
            session.exec(delete(Booking))  # type: ignore[call-overload]
            session.exec(delete(DiscountCode))  # type: ignore[call-overload]
            session.exec(delete(TripMerchandise))  # type: ignore[call-overload]
            session.exec(delete(MerchandiseVariation))  # type: ignore[call-overload]
            session.exec(delete(Merchandise))  # type: ignore[call-overload]
            session.exec(delete(TripBoatPricing))  # type: ignore[call-overload]
            session.exec(delete(TripBoat))  # type: ignore[call-overload]
            session.exec(delete(BoatPricing))  # type: ignore[call-overload]
            session.exec(delete(Boat))  # type: ignore[call-overload]
            session.exec(delete(Trip))  # type: ignore[call-overload]
            session.exec(delete(Mission))  # type: ignore[call-overload]
            session.exec(delete(Launch))  # type: ignore[call-overload]
            session.exec(delete(Provider))  # type: ignore[call-overload]
            session.exec(delete(Jurisdiction))  # type: ignore[call-overload]
            session.exec(delete(Location))  # type: ignore[call-overload]
            session.exec(delete(User))  # type: ignore[call-overload]
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error during test cleanup: {e}")


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """TestClient with get_db overridden to use the test db session."""

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture(scope="function")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="function")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )


@pytest.fixture(scope="function")
def test_location(db: Session) -> Location:
    """Create a test location."""
    location = Location(
        name="Test Launch Site",
        state="FL",
        timezone="America/New_York",
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@pytest.fixture(scope="function")
def test_jurisdiction(db: Session, test_location: Location) -> Jurisdiction:
    """Create a test jurisdiction."""
    jurisdiction = Jurisdiction(
        name="Test County",
        sales_tax_rate=0.07,
        location_id=test_location.id,
    )
    db.add(jurisdiction)
    db.commit()
    db.refresh(jurisdiction)
    return jurisdiction


@pytest.fixture(scope="function")
def test_provider(db: Session, test_jurisdiction: Jurisdiction) -> Provider:
    """Create a test provider."""
    provider = Provider(
        name="Test Boat Tours",
        location="123 Marina Way",
        address="123 Marina Way, Port City, FL 32000",
        jurisdiction_id=test_jurisdiction.id,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@pytest.fixture(scope="function")
def test_launch(db: Session, test_location: Location) -> Launch:
    """Create a test launch scheduled for future."""
    future_date = datetime.now(timezone.utc) + timedelta(days=30)
    launch = Launch(
        name="Test Falcon 9 Launch",
        launch_timestamp=future_date,
        summary="Test Starlink mission",
        location_id=test_location.id,
    )
    db.add(launch)
    db.commit()
    db.refresh(launch)
    return launch


@pytest.fixture(scope="function")
def test_mission(db: Session, test_launch: Launch) -> Mission:
    """Create a test mission."""
    mission = Mission(
        name="Test Launch Viewing Mission",
        launch_id=test_launch.id,
        active=True,
        refund_cutoff_hours=24,
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission


@pytest.fixture(scope="function")
def test_trip(db: Session, test_mission: Mission) -> Trip:
    """Create a test trip."""
    departure = datetime.now(timezone.utc) + timedelta(days=30, hours=-2)
    trip = Trip(
        mission_id=test_mission.id,
        name="Morning Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@pytest.fixture(scope="function")
def test_boat(db: Session, test_provider: Provider) -> Boat:
    """Create a test boat."""
    boat = Boat(
        name="Test Vessel",
        slug="test-vessel",
        capacity=50,
        provider_id=test_provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)
    return boat


@pytest.fixture(scope="function")
def test_boat_pricing(db: Session, test_boat: Boat) -> BoatPricing:
    """Create default boat pricing."""
    pricing = BoatPricing(
        boat_id=test_boat.id,
        ticket_type="adult",
        price=5000,  # $50.00 in cents
        capacity=40,
    )
    db.add(pricing)
    db.commit()
    db.refresh(pricing)
    return pricing


@pytest.fixture(scope="function")
def test_trip_boat(db: Session, test_trip: Trip, test_boat: Boat) -> TripBoat:
    """Create a trip-boat association."""
    trip_boat = TripBoat(
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        max_capacity=None,
        use_only_trip_pricing=False,
    )
    db.add(trip_boat)
    db.commit()
    db.refresh(trip_boat)
    return trip_boat


@pytest.fixture(scope="function")
def test_trip_boat_pricing(db: Session, test_trip_boat: TripBoat) -> TripBoatPricing:
    """Create trip-specific pricing override."""
    pricing = TripBoatPricing(
        trip_boat_id=test_trip_boat.id,
        ticket_type="adult",
        price=6000,  # $60.00 in cents (override)
        capacity=35,  # Override capacity
    )
    db.add(pricing)
    db.commit()
    db.refresh(pricing)
    return pricing


@pytest.fixture(scope="function")
def test_booking(db: Session) -> Booking:
    """Create a test booking."""
    import uuid

    booking = Booking(
        confirmation_code=f"TEST{uuid.uuid4().hex[:8].upper()}",
        first_name="John",
        last_name="Doe",
        user_email="john.doe@example.com",
        user_phone="+1234567890",
        billing_address="123 Test St, Test City, FL 32000",
        subtotal=5000,
        discount_amount=0,
        tax_amount=350,
        tip_amount=0,
        total_amount=5350,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@pytest.fixture(scope="function")
def test_booking_item(
    db: Session,
    test_booking: Booking,
    test_trip: Trip,
    test_boat: Boat,
) -> BookingItem:
    """Create a test booking item (ticket)."""
    item = BookingItem(
        booking_id=test_booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        item_type="adult",
        quantity=2,
        price_per_unit=5000,
        status=BookingItemStatus.active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture(scope="function")
def test_merchandise(db: Session) -> Merchandise:
    """Create a test merchandise (catalog item)."""
    merch = Merchandise(
        name="Test T-Shirt",
        description="Test merch",
        price=2000,
        quantity_available=50,
    )
    db.add(merch)
    db.commit()
    db.refresh(merch)
    return merch


@pytest.fixture(scope="function")
def test_discount_code(db: Session) -> DiscountCode:
    """Create a test discount code (percentage, active, no restrictions)."""
    code = DiscountCode(
        code="TEST10",
        description="10% off",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        is_active=True,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    return code
