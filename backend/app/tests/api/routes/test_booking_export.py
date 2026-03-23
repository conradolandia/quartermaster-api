"""Tests for booking CSV export (booking_export.py)."""

import csv
import io
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
    Mission,
    PaymentStatus,
    Provider,
    Trip,
    TripBoat,
)

BOOKINGS_EXPORT_URL = f"{settings.API_V1_STR}/bookings/export/csv"


def test_export_csv_requires_auth(client: TestClient) -> None:
    r = client.get(BOOKINGS_EXPORT_URL)
    assert r.status_code == 401


def test_export_csv_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(BOOKINGS_EXPORT_URL, headers=superuser_token_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert len(r.content) >= 0


def test_export_csv_with_filters(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"booking_status": "confirmed"},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_with_mission_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_mission: "object",
) -> None:
    from app.models import Mission

    mission = test_mission
    assert isinstance(mission, Mission)
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"mission_id": str(mission.id)},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_with_fields_param(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"fields": "confirmation_code,customer_name,email"},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_with_trip_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip: "object",
) -> None:
    from app.models import Trip

    trip = test_trip
    assert isinstance(trip, Trip)
    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"trip_id": str(trip.id)},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


def test_export_csv_distinct_one_row_per_booking_with_multiple_ticket_items(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    test_mission: Mission,
    test_provider: Provider,
) -> None:
    """Join with BookingItem must not duplicate booking rows (one CSV line per booking)."""
    from datetime import datetime, timedelta, timezone

    boat = Boat(
        name="Export Boat",
        slug="export-boat",
        capacity=30,
        provider_id=test_provider.id,
    )
    db.add(boat)
    db.commit()
    db.refresh(boat)
    departure = datetime.now(timezone.utc) + timedelta(days=15)
    trip = Trip(
        mission_id=test_mission.id,
        name="Export Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    db.add(TripBoat(trip_id=trip.id, boat_id=boat.id))
    db.commit()

    code = f"CSV{uuid.uuid4().hex[:8].upper()}"
    booking = Booking(
        confirmation_code=code,
        first_name="Multi",
        last_name="Line",
        user_email="multi@example.com",
        user_phone="+1",
        billing_address="addr",
        subtotal=20000,
        discount_amount=0,
        tax_amount=0,
        tip_amount=0,
        total_amount=20000,
        payment_status=PaymentStatus.paid,
        booking_status=BookingStatus.confirmed,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    for qty, label in ((1, "adult"), (1, "child")):
        db.add(
            BookingItem(
                booking_id=booking.id,
                trip_id=trip.id,
                boat_id=boat.id,
                item_type=label,
                quantity=qty,
                price_per_unit=10000,
                status=BookingItemStatus.active,
            )
        )
    db.commit()

    r = client.get(
        BOOKINGS_EXPORT_URL,
        headers=superuser_token_headers,
        params={"trip_id": str(trip.id), "fields": "confirmation_code,booking_status"},
    )
    assert r.status_code == 200
    reader = csv.reader(io.StringIO(r.text))
    rows = list(reader)
    assert rows[0][0] == "Confirmation Code"
    assert rows[0][1] == "Booking Status"
    matching = [row for row in rows[1:] if row and row[0] == code]
    assert len(matching) == 1
    assert matching[0][1] == "confirmed"


def test_export_csv_booking_status_column_aligns_with_row_data(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_booking: Booking,
) -> None:
    """Default export includes Booking Status column with values aligned to rows."""
    r = client.get(BOOKINGS_EXPORT_URL, headers=superuser_token_headers)
    assert r.status_code == 200
    reader = csv.reader(io.StringIO(r.text))
    rows = list(reader)
    header = rows[0]
    assert "Booking Status" in header
    idx = header.index("Booking Status")
    if len(rows) > 1:
        assert rows[1][idx] in (
            "confirmed",
            "draft",
            "cancelled",
            "checked_in",
            "completed",
        )
