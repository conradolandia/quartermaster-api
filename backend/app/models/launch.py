import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from pydantic import field_serializer
from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.location import Location


# Launch models
class LaunchBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    launch_timestamp: datetime
    summary: str = Field(max_length=1000)
    location_id: uuid.UUID = Field(foreign_key="location.id")
    archived: bool = Field(default=False)


class LaunchCreate(LaunchBase):
    pass


class LaunchUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    launch_timestamp: datetime | None = None
    summary: str | None = Field(default=None, max_length=1000)
    location_id: uuid.UUID | None = None
    archived: bool | None = None


class Launch(LaunchBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    launch_timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
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
    # Unidirectional relationship - launch knows its location but location doesn't track launches
    location: "Location" = Relationship()


class LaunchPublic(LaunchBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    timezone: str = "UTC"  # IANA name from launch's location; for display

    @field_serializer("launch_timestamp", "created_at", "updated_at")
    def serialize_datetime_utc(self, dt: datetime):
        """Serialize datetimes with Z so clients parse as UTC and display in local time."""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class LaunchesPublic(SQLModel):
    data: list[LaunchPublic]
    count: int
