import uuid
from datetime import datetime, timezone

from pydantic import EmailStr, validator
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

    @validator("state")
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

    @validator("state")
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
