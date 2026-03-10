"""Tests for discount codes endpoints (discount_codes.py)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import DiscountCode, Mission, Trip
from app.models.enums import DiscountCodeType

DISCOUNT_CODES_URL = f"{settings.API_V1_STR}/discount-codes"


def test_list_discount_codes_requires_auth(client: TestClient) -> None:
    r = client.get(DISCOUNT_CODES_URL + "/")
    assert r.status_code == 401


def test_list_discount_codes_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_discount_code: DiscountCode,
) -> None:
    r = client.get(DISCOUNT_CODES_URL + "/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(dc["code"] == test_discount_code.code for dc in data)


def test_list_discount_codes_filter_active(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_discount_code: DiscountCode,
) -> None:
    inactive = DiscountCode(
        code="INACTIVE",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.05,
        is_active=False,
    )
    db.add(inactive)
    db.commit()
    r = client.get(
        DISCOUNT_CODES_URL + "/?is_active=true",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    codes = r.json()
    assert all(dc["is_active"] for dc in codes)
    r_inactive = client.get(
        DISCOUNT_CODES_URL + "/?is_active=false",
        headers=superuser_token_headers,
    )
    assert r_inactive.status_code == 200
    assert any(dc["code"] == "INACTIVE" for dc in r_inactive.json())


def test_create_discount_code_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    payload = {
        "code": "NEW20",
        "description": "20% off",
        "discount_type": "percentage",
        "discount_value": 0.20,
    }
    r = client.post(
        DISCOUNT_CODES_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["code"] == "NEW20"
    assert data["discount_value"] == 0.20


def test_create_discount_code_duplicate_returns_400(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_discount_code: DiscountCode,
) -> None:
    payload = {
        "code": test_discount_code.code.upper(),
        "description": "Duplicate",
        "discount_type": "percentage",
        "discount_value": 0.15,
    }
    r = client.post(
        DISCOUNT_CODES_URL + "/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 400
    assert "already exists" in r.json().get("detail", "")


def test_get_discount_code_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_discount_code: DiscountCode,
) -> None:
    r = client.get(
        f"{DISCOUNT_CODES_URL}/{test_discount_code.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(test_discount_code.id)
    assert r.json()["code"] == test_discount_code.code


def test_get_discount_code_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.get(
        f"{DISCOUNT_CODES_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_update_discount_code_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    test_discount_code: DiscountCode,
) -> None:
    r = client.put(
        f"{DISCOUNT_CODES_URL}/{test_discount_code.id}",
        headers=superuser_token_headers,
        json={"description": "Updated description"},
    )
    assert r.status_code == 200
    assert r.json()["description"] == "Updated description"


def test_update_discount_code_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.put(
        f"{DISCOUNT_CODES_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"description": "No"},
    )
    assert r.status_code == 404


def test_delete_discount_code_success(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    code = DiscountCode(
        code="TODELETE",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.05,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.delete(
        f"{DISCOUNT_CODES_URL}/{code.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert db.get(DiscountCode, code.id) is None


def test_delete_discount_code_not_found(
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    r = client.delete(
        f"{DISCOUNT_CODES_URL}/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


# --- validate (public) ---


def test_validate_discount_code_success(
    client: TestClient,
    test_discount_code: DiscountCode,
) -> None:
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate/{test_discount_code.code}",
    )
    assert r.status_code == 200
    assert r.json()["code"] == test_discount_code.code


def test_validate_discount_code_not_found(client: TestClient) -> None:
    r = client.get(f"{DISCOUNT_CODES_URL}/validate/NONEXISTENT")
    assert r.status_code == 404


def test_validate_discount_code_inactive_returns_400(
    client: TestClient,
    db: Session,
) -> None:
    code = DiscountCode(
        code="INACTIVE_V",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        is_active=False,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(f"{DISCOUNT_CODES_URL}/validate/{code.code}")
    assert r.status_code == 400
    assert "not active" in r.json().get("detail", "")


def test_validate_discount_code_not_yet_valid_returns_400(
    client: TestClient,
    db: Session,
) -> None:
    later = datetime.now(timezone.utc) + timedelta(days=1)
    code = DiscountCode(
        code="FUTURE",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        valid_from=later,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(f"{DISCOUNT_CODES_URL}/validate/{code.code}")
    assert r.status_code == 400
    assert "not yet valid" in r.json().get("detail", "")


def test_validate_discount_code_expired_returns_400(
    client: TestClient,
    db: Session,
) -> None:
    past = datetime.now(timezone.utc) - timedelta(days=1)
    code = DiscountCode(
        code="EXPIRED",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        valid_until=past,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(f"{DISCOUNT_CODES_URL}/validate/{code.code}")
    assert r.status_code == 400
    assert "expired" in r.json().get("detail", "")


def test_validate_discount_code_max_uses_returns_400(
    client: TestClient,
    db: Session,
) -> None:
    code = DiscountCode(
        code="MAXED",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        max_uses=1,
        used_count=1,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(f"{DISCOUNT_CODES_URL}/validate/{code.code}")
    assert r.status_code == 400
    assert "maximum usage" in r.json().get("detail", "")


def test_validate_discount_code_min_order_returns_400(
    client: TestClient,
    db: Session,
) -> None:
    code = DiscountCode(
        code="MINORDER",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        min_order_amount=10000,  # $100
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate/{code.code}",
        params={"subtotal_cents": 5000},
    )
    assert r.status_code == 400
    assert "Minimum order" in r.json().get("detail", "")


def test_validate_discount_code_restriction_requires_trip_id_returns_400(
    client: TestClient,
    db: Session,
    test_trip: Trip,
) -> None:
    code = DiscountCode(
        code="RESTRICTED",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        restricted_trip_id=test_trip.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(f"{DISCOUNT_CODES_URL}/validate/{code.code}")
    assert r.status_code == 400
    assert "trip first" in r.json().get("detail", "")


def test_validate_discount_code_restriction_valid_trip(
    client: TestClient,
    db: Session,
    test_trip: Trip,
) -> None:
    code = DiscountCode(
        code="TRIPOK",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        restricted_trip_id=test_trip.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate/{code.code}",
        params={"trip_id": str(test_trip.id)},
    )
    assert r.status_code == 200
    assert r.json()["code"] == "TRIPOK"


def test_validate_discount_code_restriction_wrong_trip_returns_400(
    client: TestClient,
    db: Session,
    test_trip: Trip,
    test_mission: Mission,
) -> None:
    # Code restricted to test_trip; we pass another trip in same mission
    base = datetime.now(timezone.utc) + timedelta(days=29)
    other_trip = Trip(
        mission_id=test_mission.id,
        name="Other Trip",
        type="launch_viewing",
        active=True,
        booking_mode="public",
        check_in_time=base,
        boarding_time=base + timedelta(hours=1),
        departure_time=base + timedelta(hours=2),
    )
    db.add(other_trip)
    db.commit()
    db.refresh(other_trip)
    code = DiscountCode(
        code="WRONGTRIP",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.10,
        restricted_trip_id=test_trip.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate/{code.code}",
        params={"trip_id": str(other_trip.id)},
    )
    assert r.status_code == 400
    assert "not valid for this trip" in r.json().get("detail", "")


# --- validate-access (early_bird access codes) ---


def test_validate_access_code_success(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    code = DiscountCode(
        code="ACCESS1",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["discount_code"] is not None


def test_validate_access_code_not_found(client: TestClient) -> None:
    r = client.get(f"{DISCOUNT_CODES_URL}/validate-access/NOTFOUND")
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not found" in (r.json().get("message") or "").lower()


def test_validate_access_code_not_access_code_returns_invalid(
    client: TestClient,
    test_discount_code: DiscountCode,
) -> None:
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{test_discount_code.code}",
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not a valid access code" in (r.json().get("message") or "")


def test_update_discount_code_duplicate_code_returns_400(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
    test_discount_code: DiscountCode,
) -> None:
    """Update code to match another existing code -> 400."""
    other = DiscountCode(
        code="OTHER",
        discount_type=DiscountCodeType.percentage,
        discount_value=0.05,
    )
    db.add(other)
    db.commit()
    db.refresh(other)
    r = client.put(
        f"{DISCOUNT_CODES_URL}/{test_discount_code.id}",
        headers=superuser_token_headers,
        json={"code": "OTHER"},
    )
    assert r.status_code == 400
    assert "already exists" in r.json().get("detail", "")


def test_validate_access_code_inactive_returns_invalid(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    code = DiscountCode(
        code="ACCINACTIVE",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
        is_active=False,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not active" in (r.json().get("message") or "").lower()


def test_validate_access_code_not_yet_valid_returns_invalid(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    later = datetime.now(timezone.utc) + timedelta(days=1)
    code = DiscountCode(
        code="ACCFUTURE",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
        valid_from=later,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not yet valid" in (r.json().get("message") or "").lower()


def test_validate_access_code_expired_returns_invalid(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    past = datetime.now(timezone.utc) - timedelta(days=1)
    code = DiscountCode(
        code="ACCEXPIRED",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
        valid_until=past,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "expired" in (r.json().get("message") or "").lower()


def test_validate_access_code_max_uses_returns_invalid(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    code = DiscountCode(
        code="ACCMAXED",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
        max_uses=1,
        used_count=1,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(test_mission.id)},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "maximum usage" in (r.json().get("message") or "").lower()


def test_validate_access_code_wrong_mission_returns_invalid(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    code = DiscountCode(
        code="ACCWRONGMISSION",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(uuid.uuid4())},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not valid for this mission" in (r.json().get("message") or "")


def test_validate_access_code_mission_not_found_returns_invalid(
    client: TestClient,
    db: Session,
) -> None:
    code = DiscountCode(
        code="ACCNOMISSION",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(uuid.uuid4())},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "Mission not found" in (r.json().get("message") or "")


def test_validate_access_code_restricted_mission_mismatch(
    client: TestClient,
    db: Session,
    test_mission: Mission,
) -> None:
    other_mission = Mission(
        name="Other Mission",
        launch_id=test_mission.launch_id,
        active=True,
        refund_cutoff_hours=12,
    )
    db.add(other_mission)
    db.commit()
    db.refresh(other_mission)
    code = DiscountCode(
        code="ACCRESTMISSION",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=test_mission.id,
        restricted_mission_id=test_mission.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(other_mission.id)},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not valid for this mission" in (r.json().get("message") or "")


def test_validate_access_code_restricted_launch_mismatch(
    client: TestClient,
    db: Session,
    test_mission: Mission,
    test_launch: "object",
) -> None:
    from app.models import Launch

    launch = test_launch
    assert isinstance(launch, Launch)
    other_launch = Launch(
        name="Other Launch",
        launch_timestamp=launch.launch_timestamp,
        summary="Other",
        location_id=launch.location_id,
    )
    db.add(other_launch)
    db.commit()
    db.refresh(other_launch)
    other_mission = Mission(
        name="Other M",
        launch_id=other_launch.id,
        active=True,
        refund_cutoff_hours=12,
    )
    db.add(other_mission)
    db.commit()
    db.refresh(other_mission)
    code = DiscountCode(
        code="ACCRESTLAUNCH",
        discount_type=DiscountCodeType.percentage,
        discount_value=0,
        is_access_code=True,
        access_code_mission_id=other_mission.id,
        restricted_launch_id=launch.id,
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    r = client.get(
        f"{DISCOUNT_CODES_URL}/validate-access/{code.code}",
        params={"mission_id": str(other_mission.id)},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "not valid for this launch" in (r.json().get("message") or "")
