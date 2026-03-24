import re
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from pydantic import field_validator
from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.discount import DiscountCodePublic
from app.models.enums import (
    BookingItemStatus,
    BookingStatus,
    PaymentStatus,
)

if TYPE_CHECKING:
    from app.models.boat import Boat
    from app.models.discount import DiscountCode
    from app.models.mission import Mission
    from app.models.trip import Trip


def _validate_name_part(v: str | None, max_length: int = 128) -> str | None:
    """Validate name part (first/last): max chars, letters, numbers, spaces, hyphens, apostrophes; no double quotes."""
    if v is None:
        return v
    if len(v) > max_length:
        raise ValueError(f"Name must be {max_length} characters or less")
    if '"' in v:
        raise ValueError(
            "Name cannot contain double quotes. Letters (including accented), numbers, spaces, hyphens, and apostrophes are allowed."
        )
    if not re.match(r"^[\w\s\-']+$", v, re.UNICODE):
        raise ValueError(
            "Name can only contain letters (including accented), numbers, spaces, hyphens, and apostrophes"
        )
    return v


class BookingItemBase(SQLModel):
    booking_id: uuid.UUID = Field(foreign_key="booking.id")
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    # Optional link to a specific trip merchandise item when item_type is merchandise
    trip_merchandise_id: uuid.UUID | None = Field(
        default=None, foreign_key="tripmerchandise.id"
    )
    # Optional link to merchandise variation (for per-variant inventory and fulfillment)
    merchandise_variation_id: uuid.UUID | None = Field(
        default=None, foreign_key="merchandisevariation.id"
    )
    item_type: str = Field(
        max_length=255
    )  # ticket_type (e.g. adult_ticket) or merchandise name
    quantity: int = Field(ge=1)
    price_per_unit: int = Field(ge=0)  # cents
    status: BookingItemStatus = Field(default=BookingItemStatus.active)
    refund_reason: str | None = Field(default=None, max_length=255)
    refund_notes: str | None = Field(default=None, max_length=1000)
    # Selected variant for merchandise (e.g. "M" when variant_name is "Size")
    variant_option: str | None = Field(default=None, max_length=64)


class BookingItemCreate(SQLModel):
    trip_id: uuid.UUID = Field(foreign_key="trip.id")
    boat_id: uuid.UUID = Field(foreign_key="boat.id")
    trip_merchandise_id: uuid.UUID | None = Field(
        default=None, foreign_key="tripmerchandise.id"
    )
    merchandise_variation_id: uuid.UUID | None = Field(
        default=None, foreign_key="merchandisevariation.id"
    )
    item_type: str = Field(
        max_length=255
    )  # ticket_type (e.g. adult_ticket) or merchandise name
    quantity: int = Field(ge=1)
    price_per_unit: int = Field(ge=0)  # cents
    status: BookingItemStatus = Field(default=BookingItemStatus.active)
    refund_reason: str | None = Field(default=None, max_length=255)
    refund_notes: str | None = Field(default=None, max_length=1000)
    variant_option: str | None = Field(default=None, max_length=64)


class BookingItemUpdate(SQLModel):
    status: BookingItemStatus | None = None
    refund_reason: str | None = None
    refund_notes: str | None = None
    item_type: str | None = Field(default=None, max_length=255)
    price_per_unit: int | None = Field(default=None, ge=0)
    boat_id: uuid.UUID | None = Field(default=None, foreign_key="boat.id")


class BookingItemQuantityUpdate(SQLModel):
    """Payload to update a single booking item's quantity (draft/pending_payment only). Quantity 0 removes the item."""

    id: uuid.UUID = Field(foreign_key="bookingitem.id")
    quantity: int = Field(ge=0)


class BookingItem(BookingItemBase, table=True):
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
    booking: "Booking" = Relationship(back_populates="items")
    trip: "Trip" = Relationship()
    boat: "Boat" = Relationship()


class BookingItemPublic(BookingItemBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class BookingBase(SQLModel):
    confirmation_code: str = Field(index=True, unique=True, max_length=32)
    first_name: str = Field(max_length=128)
    last_name: str = Field(max_length=128)

    @field_validator("first_name", mode="before")
    @classmethod
    def validate_first_name(cls, v: str) -> str:
        result = _validate_name_part(v, max_length=128)
        assert result is not None
        return result

    @field_validator("last_name", mode="before")
    @classmethod
    def validate_last_name(cls, v: str) -> str:
        result = _validate_name_part(v, max_length=128)
        assert result is not None
        return result

    user_email: str = Field(max_length=255)
    user_phone: str = Field(max_length=40)
    billing_address: str = Field(max_length=1000)
    subtotal: int = Field(ge=0)  # cents
    discount_amount: int = Field(ge=0)  # cents
    tax_amount: int = Field(ge=0)  # cents
    tip_amount: int = Field(ge=0)  # cents
    total_amount: int = Field(ge=0)  # cents
    refunded_amount_cents: int = Field(default=0, ge=0)  # cumulative refunds
    refund_reason: str | None = Field(default=None, max_length=255)
    refund_notes: str | None = Field(default=None, max_length=1000)
    payment_intent_id: str | None = Field(default=None, max_length=255)
    special_requests: str | None = Field(default=None, max_length=1000)
    payment_status: PaymentStatus | None = Field(default=None)
    booking_status: BookingStatus = Field(default=BookingStatus.draft)
    launch_updates_pref: bool = Field(default=False)
    discount_code_id: uuid.UUID | None = Field(
        default=None, foreign_key="discountcode.id"
    )
    admin_notes: str | None = Field(default=None, max_length=2000)


class BookingCreate(SQLModel):
    confirmation_code: str = Field(index=True, unique=True, max_length=32)
    first_name: str = Field(max_length=128)
    last_name: str = Field(max_length=128)
    user_email: str = Field(max_length=255)

    @field_validator("first_name", mode="before")
    @classmethod
    def validate_first_name(cls, v: str) -> str:
        result = _validate_name_part(v, max_length=128)
        assert result is not None
        return result

    @field_validator("last_name", mode="before")
    @classmethod
    def validate_last_name(cls, v: str) -> str:
        result = _validate_name_part(v, max_length=128)
        assert result is not None
        return result

    user_phone: str = Field(max_length=40)
    billing_address: str = Field(max_length=1000)
    subtotal: int = Field(ge=0)  # cents
    discount_amount: int = Field(ge=0)  # cents
    tax_amount: int = Field(ge=0)  # cents
    tip_amount: int = Field(ge=0)  # cents
    total_amount: int = Field(ge=0)  # cents
    special_requests: str | None = Field(default=None, max_length=1000)
    launch_updates_pref: bool = Field(default=False)
    discount_code_id: uuid.UUID | None = Field(default=None)
    admin_notes: str | None = Field(default=None, max_length=2000)
    items: list[BookingItemCreate]


class BookingUpdate(SQLModel):
    first_name: str | None = Field(default=None, max_length=128)
    last_name: str | None = Field(default=None, max_length=128)
    user_email: str | None = Field(default=None, max_length=255)

    @field_validator("first_name", mode="before")
    @classmethod
    def validate_first_name(cls, v: str | None) -> str | None:
        return _validate_name_part(v, max_length=128)

    @field_validator("last_name", mode="before")
    @classmethod
    def validate_last_name(cls, v: str | None) -> str | None:
        return _validate_name_part(v, max_length=128)

    user_phone: str | None = Field(default=None, max_length=40)
    billing_address: str | None = Field(default=None, max_length=1000)
    booking_status: BookingStatus | None = None
    payment_status: PaymentStatus | None = None
    special_requests: str | None = None
    tip_amount: int | None = None  # cents
    discount_amount: int | None = None  # cents
    tax_amount: int | None = None  # cents
    total_amount: int | None = None  # cents
    launch_updates_pref: bool | None = None
    discount_code_id: uuid.UUID | None = None
    item_quantity_updates: list[BookingItemQuantityUpdate] | None = None
    admin_notes: str | None = None


class BookingDraftUpdate(SQLModel):
    """Public PATCH for draft/pending_payment bookings by confirmation code."""

    first_name: str | None = Field(default=None, max_length=128)
    last_name: str | None = Field(default=None, max_length=128)
    user_email: str | None = Field(default=None, max_length=255)

    @field_validator("first_name", mode="before")
    @classmethod
    def validate_first_name(cls, v: str | None) -> str | None:
        return _validate_name_part(v, max_length=128)

    @field_validator("last_name", mode="before")
    @classmethod
    def validate_last_name(cls, v: str | None) -> str | None:
        return _validate_name_part(v, max_length=128)

    user_phone: str | None = Field(default=None, max_length=40)
    billing_address: str | None = Field(default=None, max_length=1000)
    special_requests: str | None = None
    launch_updates_pref: bool | None = None
    tip_amount: int | None = None  # cents
    subtotal: int | None = None  # cents
    discount_amount: int | None = None  # cents
    tax_amount: int | None = None  # cents
    total_amount: int | None = None  # cents


class Booking(BookingBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
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
    confirmation_email_sent_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Active payment hold: set when PaymentIntent is created; counts against capacity until expiry.
    capacity_hold_expires_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    qr_code_base64: str | None = Field(default=None)
    items: list["BookingItem"] = Relationship(
        back_populates="booking",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    discount_code: Optional["DiscountCode"] = Relationship(back_populates="bookings")

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


class BookingExperienceDisplay(SQLModel):
    """Trip, mission, launch and boat display data for public booking detail (no auth, works for past trips)."""

    trip_name: str | None = None
    trip_type: str | None = None
    departure_time: str | None = None
    trip_timezone: str | None = None
    check_in_time: str | None = None
    boarding_time: str | None = None
    mission_name: str | None = None
    launch_name: str | None = None
    launch_timestamp: str | None = None
    launch_timezone: str | None = None
    launch_summary: str | None = None
    boat_name: str | None = None
    provider_name: str | None = None
    departure_location: str | None = None
    map_link: str | None = None


class BookingPublic(BookingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    items: list[BookingItemPublic]
    qr_code_base64: str | None = None
    mission_id: uuid.UUID | None = None
    mission_name: str | None = None
    trip_name: str | None = None
    trip_type: str | None = None
    discount_code: DiscountCodePublic | None = None
    experience_display: BookingExperienceDisplay | None = None


class BookingCheckoutResponse(SQLModel):
    """Public paid checkout: booking row plus Stripe client secret for Elements."""

    booking: BookingPublic
    payment_intent_id: str
    client_secret: str
    status: str = "pending_payment"
