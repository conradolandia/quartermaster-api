import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.launch import Launch


# Mission models
class MissionBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    launch_id: uuid.UUID = Field(foreign_key="launch.id")
    active: bool = Field(default=True)
    archived: bool = Field(default=False)
    refund_cutoff_hours: int = Field(default=12, ge=0, le=72)


class MissionCreate(MissionBase):
    pass


class MissionUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    launch_id: uuid.UUID | None = None
    active: bool | None = None
    archived: bool | None = None
    refund_cutoff_hours: int | None = Field(default=None, ge=0, le=72)


class Mission(MissionBase, table=True):
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
    # Unidirectional relationship - mission knows its launch but launch doesn't track missions
    launch: "Launch" = Relationship()


class MissionPublic(MissionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    timezone: str = "UTC"  # IANA name from mission's launch location; for display


class MissionWithStats(MissionPublic):
    trip_count: int = 0
    total_bookings: int = 0
    total_sales: int = 0  # cents (sum of booking.total_amount - booking.tax_amount)


class MissionsPublic(SQLModel):
    data: list[MissionPublic]
    count: int


class MissionsWithStatsPublic(SQLModel):
    data: list[MissionWithStats]
    count: int
