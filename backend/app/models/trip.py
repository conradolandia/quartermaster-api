import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from pydantic import field_serializer
from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.trip_boat import TripBoatPublic

if TYPE_CHECKING:
    from app.models.mission import Mission
    from app.models.trip_boat import TripBoat
    from app.models.trip_merchandise import TripMerchandise


# Trip models
class TripBase(SQLModel):
    mission_id: uuid.UUID = Field(foreign_key="mission.id")
    name: str | None = Field(default=None, max_length=255)  # custom label
    type: str = Field(max_length=50)  # launch_viewing or pre_launch
    active: bool = Field(default=True)
    unlisted: bool = Field(default=False)  # if True, only visible via direct link
    archived: bool = Field(
        default=False
    )  # if True, hidden from default lists and public
    booking_mode: str = Field(
        default="private", max_length=20
    )  # private, early_bird, public
    sales_open_at: datetime | None = None  # trip not bookable until this instant
    check_in_time: datetime
    boarding_time: datetime
    departure_time: datetime


class TripCreate(SQLModel):
    """API request: departure time plus minute offsets; check_in/boarding are computed."""

    mission_id: uuid.UUID = Field(foreign_key="mission.id")
    name: str | None = Field(default=None, max_length=255)
    type: str = Field(max_length=50)  # launch_viewing or pre_launch
    active: bool = Field(default=True)
    unlisted: bool = Field(default=False)
    archived: bool = Field(default=False)
    booking_mode: str = Field(default="private", max_length=20)
    sales_open_at: datetime | None = None
    departure_time: datetime
    boarding_minutes_before_departure: int | None = Field(
        default=None,
        ge=0,
        description="Minutes before departure when boarding starts; default by type",
    )
    checkin_minutes_before_boarding: int | None = Field(
        default=None,
        ge=0,
        description="Minutes before boarding when check-in opens; default by type",
    )


class TripBoatPricingCreateItem(SQLModel):
    """Pricing item for TripCreateFull; trip_boat_id is set when creating."""

    ticket_type: str = Field(max_length=32)
    price: int = Field(ge=0)  # cents
    capacity: int | None = Field(default=None, ge=0)


class TripBoatCreateItem(SQLModel):
    """Boat with optional pricing for TripCreateFull."""

    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    max_capacity: int | None = None
    use_only_trip_pricing: bool = False
    sales_enabled: bool = True
    pricing: list[TripBoatPricingCreateItem] = Field(default_factory=list)


class TripMerchandiseCreateItem(SQLModel):
    """Merchandise item for TripCreateFull; trip_id is set when creating."""

    merchandise_id: uuid.UUID = Field(foreign_key="merchandise.id")
    price_override: int | None = Field(default=None, ge=0)  # cents
    quantity_available_override: int | None = Field(default=None, ge=0)


class TripCreateFull(SQLModel):
    """Trip + boats + pricing + merchandise in one request."""

    mission_id: uuid.UUID = Field(foreign_key="mission.id")
    name: str | None = Field(default=None, max_length=255)
    type: str = Field(max_length=50)  # launch_viewing or pre_launch
    active: bool = Field(default=True)
    unlisted: bool = Field(default=False)
    archived: bool = Field(default=False)
    booking_mode: str = Field(default="private", max_length=20)
    sales_open_at: datetime | None = None
    departure_time: datetime
    boarding_minutes_before_departure: int | None = Field(default=None, ge=0)
    checkin_minutes_before_boarding: int | None = Field(default=None, ge=0)
    boats: list[TripBoatCreateItem] = Field(default_factory=list)
    merchandise: list[TripMerchandiseCreateItem] = Field(default_factory=list)


class TripUpdate(SQLModel):
    mission_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=255)
    type: str | None = Field(default=None, max_length=50)
    active: bool | None = None
    unlisted: bool | None = None
    archived: bool | None = None
    booking_mode: str | None = Field(default=None, max_length=20)
    sales_open_at: datetime | None = None
    departure_time: datetime | None = None
    boarding_minutes_before_departure: int | None = Field(
        default=None, ge=0, description="Minutes before departure when boarding starts"
    )
    checkin_minutes_before_boarding: int | None = Field(
        default=None, ge=0, description="Minutes before boarding when check-in opens"
    )


class Trip(TripBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sales_open_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    check_in_time: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    boarding_time: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    departure_time: datetime = Field(
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
    # Unidirectional relationship - trip knows its mission but mission doesn't track trips
    mission: "Mission" = Relationship()
    # Relationship to TripBoat
    trip_boats: list["TripBoat"] = Relationship(
        back_populates="trip", sa_relationship_kwargs={"lazy": "joined"}
    )
    # Relationship to TripMerchandise
    merchandise: list["TripMerchandise"] = Relationship(
        back_populates="trip", sa_relationship_kwargs={"lazy": "joined"}
    )


class TripPublic(TripBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    trip_boats: list[TripBoatPublic] = Field(default_factory=list)
    timezone: str = (
        "UTC"  # IANA name from trip's mission->launch->location; for display
    )
    effective_booking_mode: str = Field(
        default="private",
        description="Booking mode in effect (considering sales_open_at); for display.",
    )

    @field_serializer(
        "sales_open_at",
        "check_in_time",
        "boarding_time",
        "departure_time",
        "created_at",
        "updated_at",
    )
    def serialize_datetime_utc(self, dt: datetime | None):
        """Serialize datetimes with Z so clients parse as UTC and display in local time."""
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class TripWithStats(TripPublic):
    total_bookings: int = 0
    total_sales: int = 0  # cents (sum of booking.total_amount - booking.tax_amount)


class TripsPublic(SQLModel):
    data: list[TripPublic]
    count: int


class TripsWithStatsPublic(SQLModel):
    data: list[TripWithStats]
    count: int


class PublicTripsResponse(SQLModel):
    """Response for GET /trips/public/ with optional flag for access code prompt."""

    data: list[TripPublic]
    count: int
    all_trips_require_access_code: bool = False
