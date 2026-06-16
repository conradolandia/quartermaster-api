"""
Database engine and initialization entry point.

The engine is created from settings.SQLALCHEMY_DATABASE_URI. Schema bootstrap
and seed data live in app.core.seed so that init_db can use the session's
engine (e.g. a test database in pytest).
"""

import re

from sqlalchemy import text
from sqlmodel import Session, create_engine

from app.core.config import settings
from app.core.seed import run_init_db

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


def ensure_postgres_database_exists(db_name: str) -> None:
    """Create a PostgreSQL database when missing (server must already be up)."""
    if not db_name:
        return
    if not re.match(r"^[a-zA-Z0-9_]+$", db_name):
        raise ValueError(
            f"Database name must be alphanumeric and underscores only: {db_name!r}",
        )
    maint_engine = create_engine(
        str(settings.SQLALCHEMY_DATABASE_URI_MAINTENANCE),
        isolation_level="AUTOCOMMIT",
    )
    try:
        with maint_engine.connect() as conn:
            row = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": db_name},
            ).first()
            if row is None:
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    finally:
        maint_engine.dispose()


def init_db(session: Session) -> None:
    """Bootstrap schema and optionally seed data. Uses the session's engine."""
    run_init_db(session)
