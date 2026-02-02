from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from app.models import Jurisdiction, Location, User
from app.tests.utils.user import authentication_token_from_email
from app.tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        try:
            # Clean up any existing test data first to ensure isolation
            session.rollback()
            # We need to delete jurisdiction first because it has a foreign key to location
            session.execute(delete(Jurisdiction))
            session.execute(delete(Location))
            session.execute(delete(User))
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error during initial test cleanup: {e}")

        # Run database init and commit so app requests see the data
        init_db(session)
        session.commit()
        yield session

        # Clean up test data
        try:
            session.rollback()
            session.execute(delete(Jurisdiction))
            session.execute(delete(Location))
            session.execute(delete(User))
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error during test cleanup: {e}")


@pytest.fixture(scope="function")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="function")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="function")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
