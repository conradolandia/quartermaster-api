"""
Tests for app.crud.booking_items module.
"""

from sqlmodel import Session

from app.crud.booking_items import (
    get_booking_item,
    get_booking_items_by_trip,
    get_paid_ticket_count_per_boat_for_trip,
    get_paid_ticket_count_per_boat_per_item_type_for_trip,
    get_ticket_item_count_for_trip_boat,
    get_ticket_items_by_trip_boat,
    reassign_trip_boat_passengers,
)
from app.models import (
    Boat,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    PaymentStatus,
    Provider,
    Trip,
    TripBoat,
)


class TestGetBookingItem:
    """Tests for get_booking_item function."""

    def test_returns_booking_item_when_exists(
        self,
        db: Session,
        test_booking_item: BookingItem,
    ) -> None:
        result = get_booking_item(session=db, booking_item_id=test_booking_item.id)
        assert result is not None
        assert result.id == test_booking_item.id

    def test_returns_none_when_not_exists(
        self,
        db: Session,
    ) -> None:
        import uuid

        result = get_booking_item(session=db, booking_item_id=uuid.uuid4())
        assert result is None


class TestGetBookingItemsByTrip:
    """Tests for get_booking_items_by_trip function."""

    def test_returns_items_for_trip(
        self,
        db: Session,
        test_trip: Trip,
        test_booking_item: BookingItem,
    ) -> None:
        result = get_booking_items_by_trip(session=db, trip_id=test_trip.id)
        assert len(result) == 1
        assert result[0].id == test_booking_item.id

    def test_returns_empty_when_no_items(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        result = get_booking_items_by_trip(session=db, trip_id=test_trip.id)
        assert result == []


class TestGetTicketItemsByTripBoat:
    """Tests for get_ticket_items_by_trip_boat function."""

    def test_returns_ticket_items_for_trip_boat(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking_item: BookingItem,
    ) -> None:
        result = get_ticket_items_by_trip_boat(
            session=db, trip_id=test_trip.id, boat_id=test_boat.id
        )
        assert len(result) == 1
        assert result[0].id == test_booking_item.id

    def test_returns_only_ticket_items(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking_item: BookingItem,
    ) -> None:
        """Verify that ticket items (trip_merchandise_id=None) are returned."""
        result = get_ticket_items_by_trip_boat(
            session=db, trip_id=test_trip.id, boat_id=test_boat.id
        )
        assert len(result) == 1
        assert result[0].trip_merchandise_id is None


class TestGetTicketItemCountForTripBoat:
    """Tests for get_ticket_item_count_for_trip_boat function."""

    def test_returns_total_quantity(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking_item: BookingItem,
    ) -> None:
        result = get_ticket_item_count_for_trip_boat(
            session=db, trip_id=test_trip.id, boat_id=test_boat.id
        )
        assert result == test_booking_item.quantity

    def test_returns_zero_when_no_items(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
    ) -> None:
        result = get_ticket_item_count_for_trip_boat(
            session=db, trip_id=test_trip.id, boat_id=test_boat.id
        )
        assert result == 0


class TestGetPaidTicketCountPerBoatForTrip:
    """Tests for get_paid_ticket_count_per_boat_for_trip function."""

    def test_returns_count_for_confirmed_booking(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking_item: BookingItem,
    ) -> None:
        result = get_paid_ticket_count_per_boat_for_trip(
            session=db, trip_id=test_trip.id
        )
        assert test_boat.id in result
        assert result[test_boat.id] == test_booking_item.quantity

    def test_excludes_draft_booking(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
    ) -> None:
        import uuid

        draft_booking = Booking(
            confirmation_code=f"DRAFT{uuid.uuid4().hex[:6].upper()}",
            first_name="Jane",
            last_name="Doe",
            user_email="jane@example.com",
            user_phone="+1234567890",
            billing_address="456 Test Ave",
            subtotal=5000,
            discount_amount=0,
            tax_amount=350,
            tip_amount=0,
            total_amount=5350,
            payment_status=PaymentStatus.pending_payment,
            booking_status=BookingStatus.draft,
        )
        db.add(draft_booking)
        db.commit()
        db.refresh(draft_booking)

        draft_item = BookingItem(
            booking_id=draft_booking.id,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            item_type="adult",
            quantity=3,
            price_per_unit=5000,
            status=BookingItemStatus.active,
        )
        db.add(draft_item)
        db.commit()

        result = get_paid_ticket_count_per_boat_for_trip(
            session=db, trip_id=test_trip.id
        )
        assert result == {}

    def test_excludes_refunded_items(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking: Booking,
    ) -> None:
        refunded_item = BookingItem(
            booking_id=test_booking.id,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            item_type="adult",
            quantity=2,
            price_per_unit=5000,
            status=BookingItemStatus.refunded,
        )
        db.add(refunded_item)
        db.commit()

        result = get_paid_ticket_count_per_boat_for_trip(
            session=db, trip_id=test_trip.id
        )
        assert result == {}


class TestGetPaidTicketCountPerBoatPerItemTypeForTrip:
    """Tests for get_paid_ticket_count_per_boat_per_item_type_for_trip function."""

    def test_returns_count_by_type(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking: Booking,
        test_booking_item: BookingItem,
    ) -> None:
        result = get_paid_ticket_count_per_boat_per_item_type_for_trip(
            session=db, trip_id=test_trip.id
        )
        key = (test_boat.id, "adult")
        assert key in result
        assert result[key] == test_booking_item.quantity

    def test_multiple_ticket_types(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_booking: Booking,
        test_booking_item: BookingItem,
    ) -> None:
        child_item = BookingItem(
            booking_id=test_booking.id,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            item_type="child",
            quantity=3,
            price_per_unit=2500,
            status=BookingItemStatus.active,
        )
        db.add(child_item)
        db.commit()

        result = get_paid_ticket_count_per_boat_per_item_type_for_trip(
            session=db, trip_id=test_trip.id
        )
        assert (test_boat.id, "adult") in result
        assert (test_boat.id, "child") in result
        assert result[(test_boat.id, "child")] == 3


class TestReassignTripBoatPassengers:
    """Tests for reassign_trip_boat_passengers function."""

    def test_reassigns_passengers_to_new_boat(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_provider: Provider,
        test_booking_item: BookingItem,
    ) -> None:
        new_boat = Boat(
            name="New Vessel",
            slug="new-vessel",
            capacity=60,
            provider_id=test_provider.id,
        )
        db.add(new_boat)
        db.commit()
        db.refresh(new_boat)

        TripBoat(
            trip_id=test_trip.id,
            boat_id=new_boat.id,
        )
        db.commit()

        moved = reassign_trip_boat_passengers(
            session=db,
            trip_id=test_trip.id,
            from_boat_id=test_boat.id,
            to_boat_id=new_boat.id,
            type_mapping={"adult": "adult"},
        )

        assert moved == test_booking_item.quantity

        db.refresh(test_booking_item)
        assert test_booking_item.boat_id == new_boat.id
        assert test_booking_item.item_type == "adult"

    def test_returns_zero_when_no_items_to_move(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_provider: Provider,
    ) -> None:
        new_boat = Boat(
            name="Another Vessel",
            slug="another-vessel",
            capacity=60,
            provider_id=test_provider.id,
        )
        db.add(new_boat)
        db.commit()
        db.refresh(new_boat)

        moved = reassign_trip_boat_passengers(
            session=db,
            trip_id=test_trip.id,
            from_boat_id=test_boat.id,
            to_boat_id=new_boat.id,
            type_mapping={"adult": "adult"},
        )

        assert moved == 0
