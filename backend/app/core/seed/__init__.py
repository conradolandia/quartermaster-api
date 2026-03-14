"""
Database initialization and seed data.

run_init_db(session) bootstraps schema (create tables, patches) and optionally
runs seed data when RUN_INITIAL_DATA is set and the database has no users.
"""

from sqlmodel import Session, select

from app.core.config import settings
from app.models import User

from .data import run_seed_data
from .schema import bootstrap_schema


def run_init_db(session: Session) -> None:
    """
    Create tables, apply schema patches, and optionally seed data.
    Uses the session's engine for schema so tests can point at a test DB.
    """
    engine = session.get_bind()
    bootstrap_schema(engine)

    if not settings.RUN_INITIAL_DATA:
        print("RUN_INITIAL_DATA is not set; skipping initial data")
        return

    if session.exec(select(User).limit(1)).first():
        print("Database already has users; skipping initial data")
        return

    run_seed_data(session)
