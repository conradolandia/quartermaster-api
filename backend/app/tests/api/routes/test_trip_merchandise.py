"""Tests for trip-merchandise API routes."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings

TM_URL = f"{settings.API_V1_STR}/trip-merchandise"


def test_list_trip_merchandise_empty(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(TM_URL, headers=superuser_token_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_trip_merchandise_by_trip_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip,
    test_merchandise,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    tm_in = TripMerchandiseCreate(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
        quantity_available_override=10,
        price_override=2500,
    )
    tm = crud_tm.create_trip_merchandise(session=db, trip_merchandise_in=tm_in)
    db.commit()
    db.refresh(tm)

    r = client.get(
        TM_URL,
        params={"trip_id": str(test_trip.id)},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert any(m["id"] == str(tm.id) for m in data)


def test_get_trip_merchandise(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip,
    test_merchandise,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    tm_in = TripMerchandiseCreate(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
    )
    tm = crud_tm.create_trip_merchandise(session=db, trip_merchandise_in=tm_in)
    db.commit()
    db.refresh(tm)

    r = client.get(
        f"{TM_URL}/{tm.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(tm.id)
    assert r.json()["trip_id"] == str(test_trip.id)
    assert r.json()["merchandise_id"] == str(test_merchandise.id)


def test_get_trip_merchandise_404(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{TM_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_create_trip_merchandise(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_trip,
    test_merchandise,
) -> None:
    payload = {
        "trip_id": str(test_trip.id),
        "merchandise_id": str(test_merchandise.id),
        "quantity_available_override": 15,
        "price_override": 1800,
    }
    r = client.post(TM_URL, headers=superuser_token_headers, json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["trip_id"] == str(test_trip.id)
    assert data["merchandise_id"] == str(test_merchandise.id)
    assert data.get("price_override") == 1800
    assert data.get("quantity_available_override") == 15


def test_update_trip_merchandise(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip,
    test_merchandise,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    tm_in = TripMerchandiseCreate(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
    )
    tm = crud_tm.create_trip_merchandise(session=db, trip_merchandise_in=tm_in)
    db.commit()
    db.refresh(tm)

    r = client.put(
        f"{TM_URL}/{tm.id}",
        headers=superuser_token_headers,
        json={"price_override": 2200, "quantity_available_override": 8},
    )
    assert r.status_code == 200
    assert r.json()["price_override"] == 2200
    assert r.json()["quantity_available_override"] == 8


def test_delete_trip_merchandise(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_trip,
    test_merchandise,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    tm_in = TripMerchandiseCreate(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
    )
    tm = crud_tm.create_trip_merchandise(session=db, trip_merchandise_in=tm_in)
    db.commit()
    db.refresh(tm)
    tm_id = tm.id

    r = client.delete(
        f"{TM_URL}/{tm_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204

    r2 = client.get(
        f"{TM_URL}/{tm_id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 404


def test_list_public_trip_merchandise(
    client: TestClient,
    test_trip,
    test_merchandise,
    db: Session,
) -> None:
    from app.crud import trip_merchandise as crud_tm
    from app.models import TripMerchandiseCreate

    tm_in = TripMerchandiseCreate(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
    )
    crud_tm.create_trip_merchandise(session=db, trip_merchandise_in=tm_in)
    db.commit()

    r = client.get(
        f"{TM_URL}/public/",
        params={"trip_id": str(test_trip.id)},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_public_trip_merchandise_403_private_trip(
    client: TestClient,
    db: Session,
    test_mission,
) -> None:
    from datetime import datetime, timedelta, timezone

    from app.models import Trip

    departure = datetime.now(timezone.utc) + timedelta(days=14)
    private_trip = Trip(
        mission_id=test_mission.id,
        name="Private Trip",
        type="launch_viewing",
        active=True,
        booking_mode="private",
        check_in_time=departure - timedelta(hours=1),
        boarding_time=departure - timedelta(minutes=30),
        departure_time=departure,
    )
    db.add(private_trip)
    db.commit()
    db.refresh(private_trip)

    r = client.get(
        f"{TM_URL}/public/",
        params={"trip_id": str(private_trip.id)},
    )
    assert r.status_code == 403
    assert "not yet available" in r.json().get("detail", "").lower()
