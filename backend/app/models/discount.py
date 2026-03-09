import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import DiscountCodeType

if TYPE_CHECKING:
    from app.models.booking import Booking


class DiscountCodeBase(SQLModel):
    code: str = Field(unique=True, index=True, max_length=50)
    description: str | None = Field(default=None, max_length=255)
    discount_type: DiscountCodeType
    discount_value: float = Field(ge=0)  # percentage 0-1, or cents when fixed_amount
    max_uses: int | None = Field(default=None, ge=1)
    used_count: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)
    valid_from: datetime | None = Field(default=None)
    valid_until: datetime | None = Field(default=None)
    min_order_amount: int | None = Field(default=None, ge=0)  # cents
    max_discount_amount: int | None = Field(default=None, ge=0)  # cents
    # Access code fields for early_bird booking mode
    is_access_code: bool = Field(default=False)  # Grants early_bird access
    access_code_mission_id: uuid.UUID | None = Field(
        default=None
    )  # Restrict to specific mission
    # Restriction fields: code only valid when booking matches these (null = no restriction)
    restricted_trip_type: str | None = Field(
        default=None, max_length=50
    )  # launch_viewing | pre_launch
    restricted_launch_id: uuid.UUID | None = Field(default=None)
    restricted_mission_id: uuid.UUID | None = Field(default=None)
    restricted_trip_id: uuid.UUID | None = Field(default=None)


class DiscountCodeCreate(SQLModel):
    code: str = Field(max_length=50)
    description: str | None = Field(default=None, max_length=255)
    discount_type: DiscountCodeType
    discount_value: float = Field(ge=0)  # percentage 0-1, or cents when fixed_amount
    max_uses: int | None = Field(default=None, ge=1)
    is_active: bool = Field(default=True)
    valid_from: datetime | None = Field(default=None)
    valid_until: datetime | None = Field(default=None)
    min_order_amount: int | None = Field(default=None, ge=0)  # cents
    max_discount_amount: int | None = Field(default=None, ge=0)  # cents
    is_access_code: bool = Field(default=False)
    access_code_mission_id: uuid.UUID | None = Field(default=None)
    restricted_trip_type: str | None = Field(default=None, max_length=50)
    restricted_launch_id: uuid.UUID | None = Field(default=None)
    restricted_mission_id: uuid.UUID | None = Field(default=None)
    restricted_trip_id: uuid.UUID | None = Field(default=None)


class DiscountCodeUpdate(SQLModel):
    code: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=255)
    discount_type: DiscountCodeType | None = None
    discount_value: float | None = Field(default=None, ge=0)
    max_uses: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    valid_from: datetime | None = Field(default=None)
    valid_until: datetime | None = Field(default=None)
    min_order_amount: int | None = Field(default=None, ge=0)  # cents
    max_discount_amount: int | None = Field(default=None, ge=0)  # cents
    is_access_code: bool | None = None
    access_code_mission_id: uuid.UUID | None = Field(default=None)
    restricted_trip_type: str | None = Field(default=None, max_length=50)
    restricted_launch_id: uuid.UUID | None = Field(default=None)
    restricted_mission_id: uuid.UUID | None = Field(default=None)
    restricted_trip_id: uuid.UUID | None = Field(default=None)


class DiscountCode(DiscountCodeBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    valid_from: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    valid_until: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
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
    bookings: list["Booking"] = Relationship(back_populates="discount_code")


class DiscountCodePublic(DiscountCodeBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
