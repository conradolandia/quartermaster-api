import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.jurisdiction import JurisdictionPublic

if TYPE_CHECKING:
    from app.models.jurisdiction import Jurisdiction


# Provider models
class ProviderBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    jurisdiction_id: uuid.UUID = Field(foreign_key="jurisdiction.id")
    map_link: str | None = Field(default=None, max_length=2000)


class ProviderCreate(ProviderBase):
    pass


class ProviderUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    jurisdiction_id: uuid.UUID | None = None
    map_link: str | None = Field(default=None, max_length=2000)


class Provider(ProviderBase, table=True):
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
    # Unidirectional relationship - provider knows its jurisdiction
    jurisdiction: "Jurisdiction" = Relationship()


class ProviderPublic(ProviderBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Include jurisdiction data for API responses
    jurisdiction: JurisdictionPublic | None = None


class ProvidersPublic(SQLModel):
    data: list[ProviderPublic]
    count: int
