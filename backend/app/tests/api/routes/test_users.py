"""
Minimal user API route tests.

Client fixture overrides get_db to use the test session, so app and test share the same db.
"""

import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import verify_password
from app.models import User, UserCreate
from app.tests.utils.utils import random_email, random_lower_string


def test_get_me(client: TestClient, superuser_token_headers: dict[str, str]) -> None:
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers)
    assert r.status_code == 200
    u = r.json()
    assert u["email"] == settings.FIRST_SUPERUSER
    assert u["is_superuser"]


def test_create_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    with patch("app.utils.send_email", return_value=None):
        data = {
            "email": random_email(),
            "password": random_lower_string(),
            "is_superuser": True,
        }
        r = client.post(
            f"{settings.API_V1_STR}/users/", headers=superuser_token_headers, json=data
        )
    assert r.status_code == 200
    created = r.json()
    user = crud.get_user_by_email(session=db, email=created["email"])
    assert user is not None


def test_get_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = crud.create_user(
        session=db,
        user_create=UserCreate(email=random_email(), password=random_lower_string()),
    )
    r = client.get(
        f"{settings.API_V1_STR}/users/{user.id}", headers=superuser_token_headers
    )
    assert r.status_code == 200
    assert r.json()["email"] == user.email


def test_create_user_duplicate_email(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    email = random_email()
    crud.create_user(
        session=db,
        user_create=UserCreate(
            email=email, password=random_lower_string(), is_superuser=True
        ),
    )
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json={"email": email, "password": random_lower_string(), "is_superuser": True},
    )
    assert r.status_code == 400


def test_list_users(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/users/", headers=superuser_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert len(data["data"]) >= 1


def test_update_password(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    new_pw = random_lower_string()
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json={
            "current_password": settings.FIRST_SUPERUSER_PASSWORD,
            "new_password": new_pw,
        },
    )
    assert r.status_code == 200
    user = db.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).first()
    assert verify_password(new_pw, user.hashed_password)


def test_update_password_wrong_current(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json={
            "current_password": "wrongpassword",
            "new_password": random_lower_string(),
        },
    )
    assert r.status_code == 400


def test_update_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = crud.create_user(
        session=db,
        user_create=UserCreate(email=random_email(), password=random_lower_string()),
    )
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json={"full_name": "NewName"},
    )
    assert r.status_code == 200
    db.refresh(user)
    assert user.full_name == "NewName"


def test_update_user_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.patch(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json={"full_name": "x"},
    )
    assert r.status_code == 404


def test_delete_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = crud.create_user(
        session=db,
        user_create=UserCreate(email=random_email(), password=random_lower_string()),
    )
    uid = user.id
    r = client.delete(
        f"{settings.API_V1_STR}/users/{uid}", headers=superuser_token_headers
    )
    assert r.status_code == 200
    assert db.get(User, uid) is None


def test_delete_user_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}", headers=superuser_token_headers
    )
    assert r.status_code == 404


def test_delete_self_forbidden(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = crud.get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    r = client.delete(
        f"{settings.API_V1_STR}/users/{user.id}", headers=superuser_token_headers
    )
    assert r.status_code == 403


def test_delete_me_forbidden(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers
    )
    assert r.status_code == 403
