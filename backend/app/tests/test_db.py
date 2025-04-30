from collections.abc import Generator

import pytest
from sqlmodel import Session, delete

from app.core.db import engine
from app.models import Location


@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """
    Create a fresh database session for each test.
    This ensures proper isolation between tests.
    """
    with Session(engine) as session:
        yield session
        # Cleanup after test
        try:
            # Roll back any pending transactions
            session.rollback()
            # Clean specific location data for this test
            statement = delete(Location)
            session.execute(statement)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error during test cleanup: {e}")
