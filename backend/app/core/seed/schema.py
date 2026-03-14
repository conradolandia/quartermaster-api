"""
Database schema bootstrap for initial setup.

Creates all tables from SQLModel metadata. Does not insert seed data.
Call only after app.models are loaded.
"""

from typing import TYPE_CHECKING

from sqlmodel import SQLModel

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine


def bootstrap_schema(engine: "Engine") -> None:
    """Create all tables. Safe to call multiple times."""
    SQLModel.metadata.create_all(engine)
