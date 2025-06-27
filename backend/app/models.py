import enum
import uuid
from datetime import datetime, timezone

from pydantic import EmailStr, field_validator
from sqlmodel import Field, Relationship, SQLModel

from app.core.constants import VALID_US_STATES


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)


# Location models
class LocationBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    state: str = Field(min_length=2, max_length=2)

    @field_validator("state")
    def validate_state(cls, v):
        if v.upper() not in VALID_US_STATES:
            raise ValueError(
                f"Invalid state code. Must be one of {', '.join(VALID_US_STATES)}"
            )
        return v.upper()  # Ensure state is always uppercase


class LocationCreate(LocationBase):
    pass


class LocationUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    state: str | None = Field(default=None, min_length=2, max_length=2)


class Location(LocationBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )


class LocationPublic(LocationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class LocationsPublic(SQLModel):
    data: list[LocationPublic]
    count: int


# Jurisdiction models
class JurisdictionBase(SQLModel):
    name: str = Field(index=True, max_length=255)
    state: str = Field(max_length=100)
    sales_tax_rate: float = Field(ge=0.0, le=1.0)
    location_id: uuid.UUID = Field(foreign_key="location.id")

    @field_validator("state")
    def validate_state(cls, v):
        if v.upper() not in VALID_US_STATES:
            raise ValueError(
                f"Invalid state code. Must be one of {', '.join(VALID_US_STATES)}"
            )
        return v.upper()  # Ensure state is always uppercase


class JurisdictionCreate(JurisdictionBase):
    pass


class JurisdictionUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=255)
    state: str | None = Field(default=None, max_length=100)
    sales_tax_rate: float | None = Field(default=None, ge=0.0, le=1.0)
    location_id: uuid.UUID | None = Field(default=None)


class Jurisdiction(JurisdictionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    # Unidirectional relationship - jurisdiction knows its location but location doesn't track jurisdictions
    location: "Location" = Relationship()


class JurisdictionPublic(JurisdictionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class JurisdictionsPublic(SQLModel):
    data: list[JurisdictionPublic]
    count: int


# Launch models
class LaunchBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    launch_timestamp: datetime
    summary: str = Field(max_length=1000)
    location_id: uuid.UUID = Field(foreign_key="location.id")


class LaunchCreate(LaunchBase):
    pass


class LaunchUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    launch_timestamp: datetime | None = None
    summary: str | None = Field(default=None, max_length=1000)
    location_id: uuid.UUID | None = None


class Launch(LaunchBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    # Unidirectional relationship - launch knows its location but location doesn't track launches
    location: "Location" = Relationship()


class LaunchPublic(LaunchBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class LaunchesPublic(SQLModel):
    data: list[LaunchPublic]
    count: int


# Mission models
class MissionBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    launch_id: uuid.UUID = Field(foreign_key="launch.id")
    active: bool = Field(default=True)
    public: bool = Field(default=False)
    sales_open_at: datetime | None = None
    refund_cutoff_hours: int = Field(default=12, ge=0, le=72)


class MissionCreate(MissionBase):
    pass


class MissionUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    launch_id: uuid.UUID | None = None
    active: bool | None = None
    public: bool | None = None
    sales_open_at: datetime | None = None
    refund_cutoff_hours: int | None = Field(default=None, ge=0, le=72)


class Mission(MissionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    # Unidirectional relationship - mission knows its launch but launch doesn't track missions
    launch: "Launch" = Relationship()


class MissionPublic(MissionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class MissionsPublic(SQLModel):
    data: list[MissionPublic]
    count: int


# Boat models
class BoatBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    # Definimos slug como opcional con un valor predeterminado vacío
    slug: str = Field(default="", max_length=255, index=True)
    capacity: int = Field(ge=1)
    provider_name: str = Field(max_length=255)
    provider_location: str = Field(max_length=255)
    provider_address: str = Field(max_length=500)
    jurisdiction_id: uuid.UUID = Field(foreign_key="jurisdiction.id")
    map_link: str | None = Field(default=None, max_length=2000)


class BoatCreate(BoatBase):
    pass  # El slug se generará en crud.create_boat


class BoatUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    # El slug se generará automáticamente en crud.update_boat si el nombre cambia
    capacity: int | None = Field(default=None, ge=1)
    provider_name: str | None = Field(default=None, max_length=255)
    provider_location: str | None = Field(default=None, max_length=255)
    provider_address: str | None = Field(default=None, max_length=500)
    jurisdiction_id: uuid.UUID | None = None
    map_link: str | None = Field(default=None, max_length=2000)


class Boat(BoatBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    # Unidirectional relationship - boat knows its jurisdiction but jurisdiction doesn't track boats
    jurisdiction: "Jurisdiction" = Relationship()


class BoatPublic(BoatBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class BoatsPublic(SQLModel):
    data: list[BoatPublic]
    count: int


# Trip models
class TripBase(SQLModel):
    mission_id: uuid.UUID = Field(foreign_key="mission.id")
    type: str = Field(max_length=50)  # launch_viewing or pre_launch
    active: bool = Field(default=True)
    check_in_time: datetime
    boarding_time: datetime
    departure_time: datetime


class TripCreate(TripBase):
    pass


class TripUpdate(SQLModel):
    mission_id: uuid.UUID | None = None
    type: str | None = Field(default=None, max_length=50)
    active: bool | None = None
    check_in_time: datetime | None = None
    boarding_time: datetime | None = None
    departure_time: datetime | None = None


class Trip(TripBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    # Unidirectional relationship - trip knows its mission but mission doesn't track trips
    mission: "Mission" = Relationship()
    # Relationship to TripBoat
    trip_boats: list["TripBoat"] = Relationship(
        back_populates="trip", sa_relationship_kwargs={"lazy": "joined"}
    )


class TripPublic(TripBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class TripsPublic(SQLModel):
    data: list[TripPublic]
    count: int


# TripBoat models
class TripBoatBase(SQLModel):
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    max_capacity: int | None = None  # Optional override of boat's standard capacity


class TripBoatCreate(TripBoatBase):
    pass


class TripBoatUpdate(SQLModel):
    trip_id: uuid.UUID | None = None
    boat_id: uuid.UUID | None = None
    max_capacity: int | None = None


class TripBoat(TripBoatBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    # Relationships
    trip: "Trip" = Relationship(back_populates="trip_boats")
    boat: "Boat" = Relationship()


# --- BookingItem models ---
class BookingItemStatus(str, enum.Enum):
    active = "active"
    refunded = "refunded"
    fulfilled = "fulfilled"


class BookingItemBase(SQLModel):
    booking_id: uuid.UUID = Field(foreign_key="booking.id")
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    item_type: str = Field(max_length=32)  # e.g. adult_ticket, child_ticket
    quantity: int = Field(ge=1)
    price_per_unit: float = Field(ge=0)
    status: BookingItemStatus = Field(default=BookingItemStatus.active)
    refund_reason: str | None = Field(default=None, max_length=255)
    refund_notes: str | None = Field(default=None, max_length=1000)


class BookingItemCreate(SQLModel):
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    item_type: str = Field(max_length=32)  # e.g. adult_ticket, child_ticket
    quantity: int = Field(ge=1)
    price_per_unit: float = Field(ge=0)
    status: BookingItemStatus = Field(default=BookingItemStatus.active)
    refund_reason: str | None = Field(default=None, max_length=255)
    refund_notes: str | None = Field(default=None, max_length=1000)


class BookingItemUpdate(SQLModel):
    status: BookingItemStatus | None = None
    refund_reason: str | None = None
    refund_notes: str | None = None


class BookingItem(BookingItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    booking: "Booking" = Relationship(back_populates="items")
    trip: "Trip" = Relationship()
    boat: "Boat" = Relationship()


class BookingItemPublic(BookingItemBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Booking models ---
class BookingStatus(str, enum.Enum):
    draft = "draft"
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    checked_in = "checked_in"
    completed = "completed"
    cancelled = "cancelled"
    refunded = "refunded"


class BookingBase(SQLModel):
    confirmation_code: str = Field(index=True, unique=True, max_length=32)
    user_name: str = Field(max_length=255)
    user_email: str = Field(max_length=255)
    user_phone: str = Field(max_length=40)
    billing_address: str = Field(max_length=1000)
    subtotal: float = Field(ge=0)
    discount_amount: float = Field(ge=0)
    tax_amount: float = Field(ge=0)
    tip_amount: float = Field(ge=0)
    total_amount: float = Field(ge=0)
    payment_intent_id: str | None = Field(default=None, max_length=255)
    special_requests: str | None = Field(default=None, max_length=1000)
    status: BookingStatus = Field(default=BookingStatus.draft)
    launch_updates_pref: bool = Field(default=False)


class BookingCreate(SQLModel):
    confirmation_code: str = Field(index=True, unique=True, max_length=32)
    user_name: str = Field(max_length=255)
    user_email: str = Field(max_length=255)
    user_phone: str = Field(max_length=40)
    billing_address: str = Field(max_length=1000)
    subtotal: float = Field(ge=0)
    discount_amount: float = Field(ge=0)
    tax_amount: float = Field(ge=0)
    tip_amount: float = Field(ge=0)
    total_amount: float = Field(ge=0)
    special_requests: str | None = Field(default=None, max_length=1000)
    launch_updates_pref: bool = Field(default=False)
    items: list[BookingItemCreate]


class BookingUpdate(SQLModel):
    status: BookingStatus | None = None
    special_requests: str | None = None
    tip_amount: float | None = None
    discount_amount: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    launch_updates_pref: bool | None = None


class Booking(BookingBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    qr_code_base64: str | None = Field(default=None)
    items: list["BookingItem"] = Relationship(
        back_populates="booking",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    @property
    def mission_id(self) -> uuid.UUID | None:
        """Get the mission ID from the first booking item's trip."""
        if self.items and len(self.items) > 0:
            return self.items[0].trip.mission_id
        return None

    @property
    def mission(self) -> "Mission | None":
        """Get the mission from the first booking item's trip."""
        if self.items and len(self.items) > 0:
            return self.items[0].trip.mission
        return None


class BookingPublic(BookingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    items: list["BookingItemPublic"]
    qr_code_base64: str | None = None
