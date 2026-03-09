import re
import uuid

from pydantic import EmailStr, field_validator
from sqlmodel import Field, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=64)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Normalize email to lowercase for case-insensitive handling."""
        if v:
            return v.lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        """Validate full_name: max 64 chars, letters, numbers, spaces, hyphens, apostrophes; no double quotes."""
        if v is None:
            return v
        if len(v) > 64:
            raise ValueError("Full name must be 64 characters or less")
        if '"' in v:
            raise ValueError(
                "Full name cannot contain double quotes. Letters (including accented), numbers, spaces, hyphens, and apostrophes are allowed."
            )
        if not re.match(r"^[\w\s\-']+$", v, re.UNICODE):
            raise ValueError(
                "Full name can only contain letters (including accented), numbers, spaces, hyphens, and apostrophes"
            )
        return v


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=64)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Normalize email to lowercase for case-insensitive handling."""
        if v:
            return v.lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        """Validate full_name: max 64 chars, letters, numbers, spaces, hyphens, apostrophes; no double quotes."""
        if v is None:
            return v
        if len(v) > 64:
            raise ValueError("Full name must be 64 characters or less")
        if '"' in v:
            raise ValueError(
                "Full name cannot contain double quotes. Letters (including accented), numbers, spaces, hyphens, and apostrophes are allowed."
            )
        if not re.match(r"^[\w\s\-']+$", v, re.UNICODE):
            raise ValueError(
                "Full name can only contain letters (including accented), numbers, spaces, hyphens, and apostrophes"
            )
        return v


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=64)
    email: EmailStr | None = Field(default=None, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        """Normalize email to lowercase for case-insensitive handling."""
        if v:
            return v.lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        """Validate full_name: max 64 chars, letters, numbers, spaces, hyphens, apostrophes; no double quotes."""
        if v is None:
            return v
        if len(v) > 64:
            raise ValueError("Full name must be 64 characters or less")
        if '"' in v:
            raise ValueError(
                "Full name cannot contain double quotes. Letters (including accented), numbers, spaces, hyphens, and apostrophes are allowed."
            )
        if not re.match(r"^[\w\s\-']+$", v, re.UNICODE):
            raise ValueError(
                "Full name can only contain letters (including accented), numbers, spaces, hyphens, and apostrophes"
            )
        return v


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int
