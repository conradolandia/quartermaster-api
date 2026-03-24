"""Optional idempotency record for POST /bookings/checkout."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlmodel import Field, SQLModel


class CheckoutIdempotency(SQLModel, table=True):
    __tablename__ = "checkout_idempotency"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    idempotency_key: str = Field(
        sa_column=Column(String(255), nullable=False, unique=True, index=True),
    )
    booking_id: uuid.UUID = Field(foreign_key="booking.id", nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
        ),
    )
