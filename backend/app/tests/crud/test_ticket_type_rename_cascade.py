"""
Tests for ticket type rename cascade logic at both BoatPricing and TripBoatPricing levels.
"""

from sqlmodel import Session

from app.crud.boat_pricing import cascade_boat_ticket_type_rename
from app.crud.trip_boat_pricing import cascade_trip_boat_ticket_type_rename
from app.models import (
    Boat,
    BoatPricing,
    Booking,
    BookingItem,
    BookingItemStatus,
    Merchandise,
    Trip,
    TripBoat,
    TripBoatPricing,
    TripMerchandise,
)


class TestCascadeTripBoatTicketTypeRename:
    """Tests for cascade_trip_boat_ticket_type_rename."""

    def test_renames_booking_items_for_trip_boat(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_trip_boat_pricing: TripBoatPricing,
        test_booking: Booking,
        test_booking_item: BookingItem,
    ) -> None:
        assert test_booking_item.item_type == "adult"

        cascade_trip_boat_ticket_type_rename(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            old_ticket_type="adult",
            new_ticket_type="standard",
        )

        db.refresh(test_booking_item)
        assert test_booking_item.item_type == "standard"

    def test_does_not_rename_merchandise_items(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_booking: Booking,
    ) -> None:
        merch = Merchandise(
            name="T-Shirt",
            price=2000,
            quantity_available=50,
        )
        db.add(merch)
        db.commit()
        db.refresh(merch)

        trip_merch = TripMerchandise(
            trip_id=test_trip.id,
            merchandise_id=merch.id,
        )
        db.add(trip_merch)
        db.commit()
        db.refresh(trip_merch)

        merch_item = BookingItem(
            booking_id=test_booking.id,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            item_type="adult",
            quantity=1,
            price_per_unit=1000,
            status=BookingItemStatus.active,
            trip_merchandise_id=trip_merch.id,
        )
        db.add(merch_item)
        db.commit()
        db.refresh(merch_item)

        cascade_trip_boat_ticket_type_rename(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            old_ticket_type="adult",
            new_ticket_type="standard",
        )

        db.refresh(merch_item)
        assert merch_item.item_type == "adult"

    def test_does_not_rename_items_on_different_boat(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_booking: Booking,
        test_booking_item: BookingItem,
        test_provider,
    ) -> None:
        other_boat = Boat(
            name="Other Vessel",
            slug="other-vessel",
            capacity=30,
            provider_id=test_provider.id,
        )
        db.add(other_boat)
        db.commit()
        db.refresh(other_boat)

        other_item = BookingItem(
            booking_id=test_booking.id,
            trip_id=test_trip.id,
            boat_id=other_boat.id,
            item_type="adult",
            quantity=1,
            price_per_unit=5000,
            status=BookingItemStatus.active,
        )
        db.add(other_item)
        db.commit()
        db.refresh(other_item)

        cascade_trip_boat_ticket_type_rename(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            old_ticket_type="adult",
            new_ticket_type="standard",
        )

        db.refresh(test_booking_item)
        assert test_booking_item.item_type == "standard"
        db.refresh(other_item)
        assert other_item.item_type == "adult"


class TestCascadeBoatTicketTypeRename:
    """Tests for cascade_boat_ticket_type_rename."""

    def test_renames_booking_items_across_trips(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
        test_booking: Booking,
        test_booking_item: BookingItem,
    ) -> None:
        assert test_booking_item.item_type == "adult"

        cascade_boat_ticket_type_rename(
            session=db,
            boat_id=test_boat.id,
            old_ticket_type="adult",
            new_ticket_type="standard",
        )

        db.refresh(test_booking_item)
        assert test_booking_item.item_type == "standard"

    def test_renames_trip_boat_pricing_rows(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
        test_trip_boat_pricing: TripBoatPricing,
    ) -> None:
        assert test_trip_boat_pricing.ticket_type == "adult"

        cascade_boat_ticket_type_rename(
            session=db,
            boat_id=test_boat.id,
            old_ticket_type="adult",
            new_ticket_type="standard",
        )

        db.refresh(test_trip_boat_pricing)
        assert test_trip_boat_pricing.ticket_type == "standard"
