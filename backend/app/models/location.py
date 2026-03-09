import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from pydantic import field_validator
from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel

from app.core.constants import VALID_US_STATES


# Location models
class LocationBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    state: str = Field(min_length=2, max_length=2)
    timezone: str = Field(default="UTC", max_length=64)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """Require IANA timezone name (e.g. America/New_York)."""
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError(
                f"Invalid timezone: {v!r}. Use IANA name (e.g. America/New_York)."
            )
        return v

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
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError(
                f"Invalid timezone: {v!r}. Use IANA name (e.g. America/New_York)."
            )
        return v


class Location(LocationBase, table=True):
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


class LocationPublic(LocationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class LocationsPublic(SQLModel):
    data: list[LocationPublic]
    count: int
