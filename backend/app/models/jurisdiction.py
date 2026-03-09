import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.location import LocationPublic

if TYPE_CHECKING:
    from app.models.location import Location


# Jurisdiction models
class JurisdictionBase(SQLModel):
    name: str = Field(index=True, max_length=255)
    sales_tax_rate: float = Field(ge=0.0, le=1.0)
    location_id: uuid.UUID = Field(foreign_key="location.id")


class JurisdictionCreate(SQLModel):
    name: str = Field(index=True, max_length=255)
    sales_tax_rate: float = Field(ge=0.0, le=1.0)
    location_id: uuid.UUID = Field(foreign_key="location.id")


class JurisdictionUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=255)
    sales_tax_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    location_id: uuid.UUID | None = Field(default=None)


class Jurisdiction(JurisdictionBase, table=True):
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
    # Unidirectional relationship - jurisdiction knows its location but location doesn't track jurisdictions
    location: "Location" = Relationship()


class JurisdictionPublic(JurisdictionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Include location data for state access
    location: LocationPublic | None = None


class JurisdictionsPublic(SQLModel):
    data: list[JurisdictionPublic]
    count: int
