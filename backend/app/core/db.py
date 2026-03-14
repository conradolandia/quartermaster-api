"""
Database engine and initialization entry point.

The engine is created from settings.SQLALCHEMY_DATABASE_URI. Schema bootstrap
and seed data live in app.core.seed so that init_db can use the session's
engine (e.g. a test database in pytest).
"""

from sqlmodel import Session, create_engine

from app.core.config import settings
from app.core.seed import run_init_db

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


def init_db(session: Session) -> None:
    """Bootstrap schema and optionally seed data. Uses the session's engine."""
    run_init_db(session)
