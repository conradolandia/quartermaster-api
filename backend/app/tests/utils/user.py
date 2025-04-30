from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import User, UserCreate, UserUpdate
from app.tests.utils.utils import random_email, random_lower_string


def user_authentication_headers(
    *, client: TestClient, email: str, password: str
) -> dict[str, str]:
    data = {"username": email, "password": password}

    try:
        r = client.post(f"{settings.API_V1_STR}/login/access-token", data=data)
        r.raise_for_status()  # Will raise an exception for 4XX/5XX responses
        response = r.json()
        auth_token = response["access_token"]
        headers = {"Authorization": f"Bearer {auth_token}"}
        return headers
    except Exception as e:
        print(f"Error authenticating user {email}: {e}")
        print(f"Response: {r.text if 'r' in locals() else 'No response'}")
        # Return empty headers as fallback
        return {}


def create_random_user(db: Session) -> User:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    return user


def authentication_token_from_email(
    *, client: TestClient, email: str, db: Session
) -> dict[str, str]:
    """
    Return a valid token for the user with given email.

    If the user doesn't exist it is created first.
    """
    try:
        password = random_lower_string()
        user = crud.get_user_by_email(session=db, email=email)
        if not user:
            user_in_create = UserCreate(
                email=email,
                password=password,
                is_active=True,
                is_superuser=False,
                full_name="Test Normal User",
            )
            user = crud.create_user(session=db, user_create=user_in_create)
        else:
            user_in_update = UserUpdate(password=password)
            if not user.id:
                raise Exception("User id not set")
            user = crud.update_user(session=db, db_user=user, user_in=user_in_update)

        return user_authentication_headers(
            client=client, email=email, password=password
        )
    except Exception as e:
        print(f"Error creating/authenticating user {email}: {e}")
        # Return empty headers as fallback
        return {}
