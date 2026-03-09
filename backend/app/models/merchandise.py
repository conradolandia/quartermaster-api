import uuid
from datetime import datetime, timezone

from pydantic import field_serializer
from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


# Merchandise (catalog) models
class MerchandiseBase(SQLModel):
    name: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price: int = Field(ge=0)  # cents
    quantity_available: int = Field(ge=0)


class MerchandiseCreate(MerchandiseBase):
    pass


class MerchandiseUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price: int | None = Field(default=None, ge=0)  # cents
    quantity_available: int | None = Field(default=None, ge=0)


class Merchandise(MerchandiseBase, table=True):
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
    variations: list["MerchandiseVariation"] = Relationship(
        back_populates="merchandise"
    )


class MerchandisePublic(MerchandiseBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Computed from variations at read time (not stored)
    variant_name: str | None = None
    variant_options: str | None = None  # comma-separated
    # Populated in list endpoint for admin table (per-variation total, sold, fulfilled)
    variations: list["MerchandiseVariationPublic"] | None = None

    @field_serializer("created_at", "updated_at")
    def serialize_datetime_utc(self, dt: datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class MerchandisesPublic(SQLModel):
    data: list[MerchandisePublic]
    count: int


# MerchandiseVariation (per-variant inventory: total, sold, fulfilled)
class MerchandiseVariationBase(SQLModel):
    merchandise_id: uuid.UUID = Field(foreign_key="merchandise.id")
    variant_value: str = Field(max_length=128)  # e.g. "M", "S-Red"
    quantity_total: int = Field(ge=0)
    quantity_sold: int = Field(default=0, ge=0)
    quantity_fulfilled: int = Field(default=0, ge=0)


class MerchandiseVariationCreate(SQLModel):
    merchandise_id: uuid.UUID = Field(foreign_key="merchandise.id")
    variant_value: str = Field(max_length=128)
    quantity_total: int = Field(ge=0)
    quantity_sold: int = Field(default=0, ge=0)
    quantity_fulfilled: int = Field(default=0, ge=0)


class MerchandiseVariationUpdate(SQLModel):
    variant_value: str | None = Field(default=None, max_length=128)
    quantity_total: int | None = Field(default=None, ge=0)
    quantity_sold: int | None = Field(default=None, ge=0)
    quantity_fulfilled: int | None = Field(default=None, ge=0)


class MerchandiseVariation(MerchandiseVariationBase, table=True):
    __table_args__ = (
        UniqueConstraint(
            "merchandise_id",
            "variant_value",
            name="uq_merchandisevariation_merchandise_variant",
        ),
    )
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
    merchandise: "Merchandise" = Relationship(back_populates="variations")


class MerchandiseVariationPublic(SQLModel):
    id: uuid.UUID
    merchandise_id: uuid.UUID
    variant_value: str
    quantity_total: int
    quantity_sold: int
    quantity_fulfilled: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_datetime_utc(self, dt: datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
