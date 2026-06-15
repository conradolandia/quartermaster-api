"""Tests for admin vs staff role permissions."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import UserCreate
from app.models.enums import UserRole
from app.tests.utils.utils import (
    get_staff_token_headers,
    random_email,
    random_lower_string,
)


def test_staff_can_login(client: TestClient, db: Session) -> None:
    headers = get_staff_token_headers(client, db)
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["role"] == UserRole.staff.value


def test_staff_cannot_list_users(client: TestClient, db: Session) -> None:
    headers = get_staff_token_headers(client, db)
    r = client.get(f"{settings.API_V1_STR}/users/", headers=headers)
    assert r.status_code == 403


def test_staff_cannot_list_bookings(client: TestClient, db: Session) -> None:
    headers = get_staff_token_headers(client, db)
    r = client.get(f"{settings.API_V1_STR}/bookings/", headers=headers)
    assert r.status_code == 403


def test_staff_can_update_own_password(client: TestClient, db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    new_password = random_lower_string()
    crud.create_user(
        session=db,
        user_create=UserCreate(
            email=email,
            password=password,
            role=UserRole.staff,
            is_active=True,
        ),
    )
    db.commit()
    login = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": email, "password": password},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=headers,
        json={"current_password": password, "new_password": new_password},
    )
    assert r.status_code == 200


def test_admin_can_create_staff_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    email = random_email()
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={
            "email": email,
            "password": random_lower_string(),
            "role": UserRole.staff.value,
            "is_active": True,
        },
    )
    assert r.status_code == 200
    user = crud.get_user_by_email(session=db, email=email)
    assert user is not None
    assert user.role == UserRole.staff


def test_staff_cannot_create_users(client: TestClient, db: Session) -> None:
    headers = get_staff_token_headers(client, db)
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=headers,
        json={
            "email": random_email(),
            "password": random_lower_string(),
            "role": UserRole.staff.value,
        },
    )
    assert r.status_code == 403
