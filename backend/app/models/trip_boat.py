import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.boat import BoatPublic

if TYPE_CHECKING:
    from app.models.boat import Boat
    from app.models.trip import Trip


# TripBoat models
class TripBoatBase(SQLModel):
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    max_capacity: int | None = None  # Optional override of boat's standard capacity
    use_only_trip_pricing: bool = Field(
        default=False,
        description="When True, ignore boat defaults; only TripBoatPricing applies.",
    )
    sales_enabled: bool = Field(
        default=True,
        description="When False, new bookings on this boat are blocked; existing reservations are kept.",
    )


class TripBoatCreate(TripBoatBase):
    pass


class TripBoatUpdate(SQLModel):
    trip_id: uuid.UUID | None = None
    boat_id: uuid.UUID | None = None
    max_capacity: int | None = None
    use_only_trip_pricing: bool | None = None
    sales_enabled: bool | None = None


class TripBoat(TripBoatBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=lambda: datetime.now(timezone.utc),
        ),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=lambda: datetime.now(timezone.utc),
        ),
    )
    # Relationships
    trip: "Trip" = Relationship(back_populates="trip_boats")
    boat: "Boat" = Relationship()
    # Per-trip, per-boat price overrides (cascade delete when trip boat is removed)
    pricing: list["TripBoatPricing"] = Relationship(
        back_populates="trip_boat", cascade_delete=True
    )


class TripBoatPublic(TripBoatBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    boat: BoatPublic


class TripBoatPublicWithAvailability(TripBoatPublic):
    """Trip boat with effective max capacity, remaining slots, and per-ticket-type pricing/availability."""

    max_capacity: int  # Effective capacity (TripBoat.max_capacity or Boat.capacity)
    remaining_capacity: int  # Seats left for sale (pricing aggregates; includes hold deduction)
    pricing: list["EffectivePricingItem"] = Field(default_factory=list)  # noqa: F821
    used_per_ticket_type: dict[str, int] = Field(
        default_factory=dict,
        description=(
            "Capacity usage per item_type: paid bookings (confirmed/checked_in/completed) plus "
            "active payment holds. Same basis as remaining_capacity and pricing.remaining."
        ),
    )
    committed_per_ticket_type: dict[str, int] = Field(
        default_factory=dict,
        description=(
            "Paid bookings only per item_type: confirmed, checked_in, or completed with active "
            "or fulfilled ticket items (excludes checkout holds)."
        ),
    )


# TripBoatPricing models (per-trip, per-boat price and capacity overrides)
class TripBoatPricingBase(SQLModel):
    trip_boat_id: uuid.UUID = Field(foreign_key="tripboat.id")
    ticket_type: str = Field(max_length=32)
    price: int = Field(ge=0)  # cents
    capacity: int | None = Field(
        default=None, ge=0
    )  # override boat-level capacity for this type


class TripBoatPricingCreate(TripBoatPricingBase):
    pass


class TripBoatPricingUpdate(SQLModel):
    ticket_type: str | None = Field(default=None, max_length=32)
    price: int | None = Field(default=None, ge=0)
    capacity: int | None = Field(default=None, ge=0)


class TripBoatPricing(TripBoatPricingBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=lambda: datetime.now(timezone.utc),
        ),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=lambda: datetime.now(timezone.utc),
        ),
    )
    trip_boat: "TripBoat" = Relationship(back_populates="pricing")


class TripBoatPricingPublic(TripBoatPricingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# Effective pricing for public API (ticket_type + price + capacity + remaining per boat for a trip)
class EffectivePricingItem(SQLModel):
    ticket_type: str
    price: int  # cents
    capacity: int  # max seats for this type on this trip/boat
    remaining: int  # capacity minus paid count for this type
