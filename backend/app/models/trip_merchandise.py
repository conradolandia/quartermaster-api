import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from pydantic import field_serializer
from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.merchandise import Merchandise
    from app.models.trip import Trip


# TripMerchandise (link trip <-> merchandise with optional overrides)
class TripMerchandiseBase(SQLModel):
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    merchandise_id: uuid.UUID = Field(foreign_key="merchandise.id")
    quantity_available_override: int | None = Field(default=None, ge=0)
    price_override: int | None = Field(default=None, ge=0)  # cents


class TripMerchandiseCreate(TripMerchandiseBase):
    pass


class TripMerchandiseUpdate(SQLModel):
    quantity_available_override: int | None = Field(default=None, ge=0)
    price_override: int | None = Field(default=None, ge=0)  # cents


class TripMerchandise(TripMerchandiseBase, table=True):
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
    trip: "Trip" = Relationship(back_populates="merchandise")
    merchandise: "Merchandise" = Relationship()


# Per-variation availability for trip merchandise (for booking form)
class TripMerchandiseVariationAvailability(SQLModel):
    variant_value: str
    quantity_available: int


# Response shape for API: effective name, description, price (cents), quantity_available (from join + overrides)
class TripMerchandisePublic(SQLModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    merchandise_id: uuid.UUID
    name: str
    description: str | None
    price: int  # cents (effective)
    quantity_available: int  # effective
    # Catalog defaults and trip overrides for UI (default)/(custom) display
    price_default: int  # cents, from catalog
    price_override: int | None = None  # cents, when set for this trip
    quantity_available_default: int  # from catalog (or sum of variations)
    quantity_available_override: int | None = None  # when set for this trip
    variant_name: str | None = None
    variant_options: str | None = None  # comma-separated; frontend splits to list
    # Per-variation quantity available (when merchandise has variations)
    variations_availability: list[TripMerchandiseVariationAvailability] | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetime_utc(self, dt: datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
