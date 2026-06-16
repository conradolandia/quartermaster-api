"""Tests for merchandise API routes (merchandise.py)."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import (
    BookingItem,
    BookingItemStatus,
    Merchandise,
    MerchandiseVariation,
    Trip,
    TripMerchandise,
)

MERCHANDISE_URL = f"{settings.API_V1_STR}/merchandise"


def test_list_merchandise_requires_auth(client: TestClient) -> None:
    r = client.get(MERCHANDISE_URL + "/")
    assert r.status_code == 401


def test_list_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(MERCHANDISE_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data


def test_create_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    payload = {
        "name": "Test Cap",
        "description": "A cap",
        "price": 1500,
        "quantity_available": 10,
    }
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Test Cap"


def test_get_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_merchandise: Merchandise,
) -> None:
    r = client.get(
        f"{MERCHANDISE_URL}/{test_merchandise.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_merchandise.id)


def test_get_merchandise_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{MERCHANDISE_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_merchandise: Merchandise,
) -> None:
    r = client.put(
        f"{MERCHANDISE_URL}/{test_merchandise.id}",
        headers=superuser_token_headers,
        json={"name": "Updated Merch", "price": 2500},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Merch"
    assert r.json()["price"] == 2500


def test_update_merchandise_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.put(
        f"{MERCHANDISE_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"name": "Ghost"},
    )
    assert r.status_code == 404


def test_delete_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    merch = Merchandise(
        name="Delete Me",
        description="temp",
        price=1000,
        quantity_available=1,
    )
    db.add(merch)
    db.commit()
    db.refresh(merch)

    r = client.delete(
        f"{MERCHANDISE_URL}/{merch.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 204
    assert db.get(Merchandise, merch.id) is None


def test_delete_merchandise_on_trip_fails(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_merchandise: Merchandise,
    test_trip: Trip,
    db: Session,
) -> None:
    db.add(
        TripMerchandise(
            trip_id=test_trip.id,
            merchandise_id=test_merchandise.id,
        )
    )
    db.commit()

    r = client.delete(
        f"{MERCHANDISE_URL}/{test_merchandise.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 400
    assert "still offered" in r.json()["detail"]


def test_duplicate_merchandise_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Original Hoodie",
            "description": "Warm",
            "price": 3000,
            "quantity_available": 5,
        },
    )
    assert r.status_code == 201
    original_id = r.json()["id"]

    db.add(
        MerchandiseVariation(
            merchandise_id=uuid.UUID(original_id),
            variant_value="L",
            quantity_total=3,
            quantity_sold=1,
            quantity_fulfilled=0,
        )
    )
    db.commit()

    r2 = client.post(
        f"{MERCHANDISE_URL}/{original_id}/duplicate",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 201
    copy = r2.json()
    assert copy["id"] != original_id
    assert "(copy)" in copy["name"]
    assert copy.get("variations") is not None


def test_duplicate_merchandise_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        f"{MERCHANDISE_URL}/{uuid.uuid4()}/duplicate",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_list_merchandise_variations_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Sized Shirt",
            "description": "Sized",
            "price": 2000,
            "quantity_available": 2,
        },
    )
    merchandise_id = r.json()["id"]
    r2 = client.post(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
        json={
            "merchandise_id": merchandise_id,
            "variant_value": "M",
            "quantity_total": 4,
        },
    )
    assert r2.status_code == 201

    r3 = client.get(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 200
    assert any(v["variant_value"] == "M" for v in r3.json())


def test_list_merchandise_variations_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{MERCHANDISE_URL}/{uuid.uuid4()}/variations",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_create_merchandise_variation_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Variant Item",
            "description": "Has variants",
            "price": 1500,
            "quantity_available": 1,
        },
    )
    merchandise_id = r.json()["id"]
    r2 = client.post(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
        json={
            "merchandise_id": merchandise_id,
            "variant_value": "Blue",
            "quantity_total": 10,
        },
    )
    assert r2.status_code == 201
    assert r2.json()["variant_value"] == "Blue"


def test_create_merchandise_variation_mismatch_merchandise_id(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_merchandise: Merchandise,
) -> None:
    r = client.post(
        f"{MERCHANDISE_URL}/{test_merchandise.id}/variations",
        headers=superuser_token_headers,
        json={
            "merchandise_id": str(uuid.uuid4()),
            "variant_value": "Red",
            "quantity_total": 1,
        },
    )
    assert r.status_code == 400
    assert "must match path" in r.json()["detail"]


def test_create_merchandise_variation_duplicate_value(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Dup Variant",
            "description": "Dup",
            "price": 1000,
            "quantity_available": 1,
        },
    )
    merchandise_id = r.json()["id"]
    payload = {
        "merchandise_id": merchandise_id,
        "variant_value": "Green",
        "quantity_total": 2,
    }
    assert (
        client.post(
            f"{MERCHANDISE_URL}/{merchandise_id}/variations",
            headers=superuser_token_headers,
            json=payload,
        ).status_code
        == 201
    )
    r2 = client.post(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r2.status_code == 400
    assert "already exists" in r2.json()["detail"]


def test_get_merchandise_variation_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Get Variant",
            "description": "Get",
            "price": 1000,
            "quantity_available": 1,
        },
    )
    merchandise_id = r.json()["id"]
    r2 = client.post(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
        json={
            "merchandise_id": merchandise_id,
            "variant_value": "S",
            "quantity_total": 2,
        },
    )
    variation_id = r2.json()["id"]
    r3 = client.get(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations/{variation_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 200
    assert r3.json()["variant_value"] == "S"


def test_get_merchandise_variation_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_merchandise: Merchandise,
) -> None:
    r = client.get(
        f"{MERCHANDISE_URL}/{test_merchandise.id}/variations/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_merchandise_variation_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Update Variant",
            "description": "Update",
            "price": 1000,
            "quantity_available": 1,
        },
    )
    merchandise_id = r.json()["id"]
    r2 = client.post(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
        json={
            "merchandise_id": merchandise_id,
            "variant_value": "Old",
            "quantity_total": 2,
        },
    )
    variation_id = r2.json()["id"]
    r3 = client.put(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations/{variation_id}",
        headers=superuser_token_headers,
        json={"quantity_total": 8},
    )
    assert r3.status_code == 200
    assert r3.json()["quantity_total"] == 8


def test_update_merchandise_variation_conflict(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Conflict Variant",
            "description": "Conflict",
            "price": 1000,
            "quantity_available": 1,
        },
    )
    merchandise_id = r.json()["id"]
    for value in ("A", "B"):
        client.post(
            f"{MERCHANDISE_URL}/{merchandise_id}/variations",
            headers=superuser_token_headers,
            json={
                "merchandise_id": merchandise_id,
                "variant_value": value,
                "quantity_total": 1,
            },
        )
    variations = client.get(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
    ).json()
    variation_a = next(v for v in variations if v["variant_value"] == "A")
    r2 = client.put(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations/{variation_a['id']}",
        headers=superuser_token_headers,
        json={"variant_value": "B"},
    )
    assert r2.status_code == 409


def test_delete_merchandise_variation_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Delete Variant",
            "description": "Delete",
            "price": 1000,
            "quantity_available": 1,
        },
    )
    merchandise_id = r.json()["id"]
    r2 = client.post(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations",
        headers=superuser_token_headers,
        json={
            "merchandise_id": merchandise_id,
            "variant_value": "Temp",
            "quantity_total": 1,
        },
    )
    variation_id = r2.json()["id"]
    r3 = client.delete(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations/{variation_id}",
        headers=superuser_token_headers,
    )
    assert r3.status_code == 204


def test_delete_merchandise_variation_referenced_by_booking(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_booking,
    test_trip: Trip,
    test_boat,
) -> None:
    r = client.post(
        MERCHANDISE_URL + "/",
        headers=superuser_token_headers,
        json={
            "name": "Booked Variant",
            "description": "Booked",
            "price": 1000,
            "quantity_available": 1,
        },
    )
    merchandise_id = uuid.UUID(r.json()["id"])
    variation = MerchandiseVariation(
        merchandise_id=merchandise_id,
        variant_value="Booked",
        quantity_total=5,
        quantity_sold=1,
        quantity_fulfilled=0,
    )
    db.add(variation)
    db.commit()
    db.refresh(variation)
    db.add(
        BookingItem(
            booking_id=test_booking.id,
            trip_id=test_trip.id,
            boat_id=test_boat.id,
            item_type="merch",
            quantity=1,
            price_per_unit=1000,
            status=BookingItemStatus.active,
            merchandise_variation_id=variation.id,
        )
    )
    db.commit()

    r2 = client.delete(
        f"{MERCHANDISE_URL}/{merchandise_id}/variations/{variation.id}",
        headers=superuser_token_headers,
    )
    assert r2.status_code == 400
    assert "referenced by booking items" in r2.json()["detail"]
