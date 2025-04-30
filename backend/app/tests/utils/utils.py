import random
import string

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import UserCreate


def random_lower_string() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=32))


def random_email() -> str:
    return f"{random_lower_string()}@{random_lower_string()}.com"


def get_superuser_token_headers(client: TestClient) -> dict[str, str]:
    # Ensure the superuser exists in the database
    from app.core.db import engine

    with Session(engine) as session:
        # Check if the superuser already exists
        superuser = crud.get_user_by_email(
            session=session, email=settings.FIRST_SUPERUSER
        )
        if not superuser:
            # Create the superuser if it doesn't exist
            user_in = UserCreate(
                email=settings.FIRST_SUPERUSER,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                is_superuser=True,
                full_name="Initial Super User",
            )
            crud.create_user(session=session, user_create=user_in)
            session.commit()

    # Now login with the superuser credentials
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}
    return headers
