"""
Tests for app.crud.effective_pricing module.
"""

from sqlmodel import Session

from app.crud.effective_pricing import (
    get_effective_capacity_per_ticket_type,
    get_effective_pricing,
    get_effective_ticket_types_for_trip,
)
from app.models import (
    Boat,
    BoatPricing,
    Trip,
    TripBoat,
    TripBoatPricing,
)


class TestGetEffectiveCapacityPerTicketType:
    """Tests for get_effective_capacity_per_ticket_type function."""

    def test_returns_boat_pricing_capacity_when_no_override(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        result = get_effective_capacity_per_ticket_type(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert "adult" in result
        assert result["adult"] == test_boat_pricing.capacity

    def test_returns_trip_override_capacity_when_set(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
        test_trip_boat_pricing: TripBoatPricing,
    ) -> None:
        result = get_effective_capacity_per_ticket_type(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert "adult" in result
        assert result["adult"] == test_trip_boat_pricing.capacity

    def test_returns_empty_when_no_trip_boat(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
    ) -> None:
        result = get_effective_capacity_per_ticket_type(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert result == {}

    def test_combines_boat_and_trip_pricing_types(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        child_pricing = BoatPricing(
            boat_id=test_boat.id,
            ticket_type="child",
            price=2500,
            capacity=10,
        )
        db.add(child_pricing)
        db.commit()

        result = get_effective_capacity_per_ticket_type(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert "adult" in result
        assert "child" in result
        assert result["child"] == 10

    def test_boat_pricing_null_capacity_is_shared_pool(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        test_boat_pricing.capacity = None
        db.add(test_boat_pricing)
        db.commit()

        result = get_effective_capacity_per_ticket_type(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert result["adult"] is None

        ep = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert len(ep) == 1
        assert ep[0].ticket_type == "adult"
        assert ep[0].capacity == test_boat.capacity
        assert ep[0].remaining == test_boat.capacity


class TestGetEffectivePricing:
    """Tests for get_effective_pricing function."""

    def test_returns_boat_pricing_when_no_override(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        result = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert len(result) == 1
        assert result[0].ticket_type == "adult"
        assert result[0].price == test_boat_pricing.price
        assert result[0].capacity == test_boat_pricing.capacity
        assert result[0].remaining == test_boat_pricing.capacity

    def test_returns_trip_override_pricing_when_set(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
        test_trip_boat_pricing: TripBoatPricing,
    ) -> None:
        result = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert len(result) == 1
        assert result[0].ticket_type == "adult"
        assert result[0].price == test_trip_boat_pricing.price
        assert result[0].capacity == test_trip_boat_pricing.capacity

    def test_remaining_accounts_for_paid_tickets(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        paid_by_type = {(test_boat.id, "adult"): 10}
        result = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            paid_by_type=paid_by_type,
        )
        assert len(result) == 1
        expected_remaining = test_boat_pricing.capacity - 10
        assert result[0].remaining == expected_remaining

    def test_remaining_cannot_be_negative(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        paid_by_type = {(test_boat.id, "adult"): 100}
        result = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            paid_by_type=paid_by_type,
        )
        assert len(result) == 1
        assert result[0].remaining == 0

    def test_returns_empty_when_no_trip_boat(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
    ) -> None:
        result = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert result == []

    def test_multiple_ticket_types_sorted(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        child_pricing = BoatPricing(
            boat_id=test_boat.id,
            ticket_type="child",
            price=2500,
            capacity=10,
        )
        db.add(child_pricing)
        db.commit()

        result = get_effective_pricing(
            session=db,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
        )
        assert len(result) == 2
        assert result[0].ticket_type == "adult"
        assert result[1].ticket_type == "child"


class TestGetEffectiveTicketTypesForTrip:
    """Tests for get_effective_ticket_types_for_trip function."""

    def test_returns_ticket_types_from_boat_pricing(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        result = get_effective_ticket_types_for_trip(
            session=db,
            trip_id=test_trip.id,
        )
        assert "adult" in result

    def test_returns_ticket_types_from_trip_boat_pricing(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
        test_trip_boat_pricing: TripBoatPricing,
    ) -> None:
        result = get_effective_ticket_types_for_trip(
            session=db,
            trip_id=test_trip.id,
        )
        assert "adult" in result

    def test_returns_union_of_all_types(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        child_pricing = BoatPricing(
            boat_id=test_boat.id,
            ticket_type="child",
            price=2500,
            capacity=10,
        )
        db.add(child_pricing)

        vip_trip_pricing = TripBoatPricing(
            trip_boat_id=test_trip_boat.id,
            ticket_type="vip",
            price=10000,
            capacity=5,
        )
        db.add(vip_trip_pricing)
        db.commit()

        result = get_effective_ticket_types_for_trip(
            session=db,
            trip_id=test_trip.id,
        )
        assert "adult" in result
        assert "child" in result
        assert "vip" in result

    def test_returns_sorted_types(
        self,
        db: Session,
        test_trip: Trip,
        test_boat: Boat,
        test_trip_boat: TripBoat,
        test_boat_pricing: BoatPricing,
    ) -> None:
        child_pricing = BoatPricing(
            boat_id=test_boat.id,
            ticket_type="child",
            price=2500,
            capacity=10,
        )
        db.add(child_pricing)
        db.commit()

        result = get_effective_ticket_types_for_trip(
            session=db,
            trip_id=test_trip.id,
        )
        assert result == sorted(result)

    def test_returns_empty_when_no_trip_boats(
        self,
        db: Session,
        test_trip: Trip,
    ) -> None:
        result = get_effective_ticket_types_for_trip(
            session=db,
            trip_id=test_trip.id,
        )
        assert result == []
