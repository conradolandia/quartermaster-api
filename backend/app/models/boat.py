import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.provider import ProviderPublic

if TYPE_CHECKING:
    from app.models.provider import Provider


# Boat models
class BoatBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    # Definimos slug como opcional con un valor predeterminado vacío
    slug: str = Field(default="", max_length=255, index=True)
    capacity: int = Field(ge=1)
    provider_id: uuid.UUID = Field(foreign_key="provider.id")


class BoatCreate(BoatBase):
    pass  # El slug se generará en crud.create_boat


class BoatUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    # El slug se generará automáticamente en crud.update_boat si el nombre cambia
    capacity: int | None = Field(default=None, ge=1)
    provider_id: uuid.UUID | None = None


class Boat(BoatBase, table=True):
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
    # Relationship to provider
    provider: "Provider" = Relationship()
    # Relationship to BoatPricing (boat-level default ticket types/prices)
    pricing: list["BoatPricing"] = Relationship(back_populates="boat")


class BoatPublic(BoatBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Include provider data for API responses
    provider: ProviderPublic | None = None


class BoatsPublic(SQLModel):
    data: list[BoatPublic]
    count: int


# BoatPricing models (boat-level default ticket types, prices, and capacity per type)
class BoatPricingBase(SQLModel):
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    ticket_type: str = Field(max_length=32)
    price: int = Field(ge=0)  # cents
    capacity: int = Field(ge=0)  # max seats for this ticket type on this boat


class BoatPricingCreate(BoatPricingBase):
    pass


class BoatPricingUpdate(SQLModel):
    ticket_type: str | None = Field(default=None, max_length=32)
    price: int | None = Field(default=None, ge=0)
    capacity: int | None = Field(default=None, ge=0)


class BoatPricing(BoatPricingBase, table=True):
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
    boat: "Boat" = Relationship(back_populates="pricing")


class BoatPricingPublic(BoatPricingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
