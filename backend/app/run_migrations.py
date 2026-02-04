"""Run Alembic migrations, or create schema from models and stamp head on a fresh DB.

On a fresh DB (no alembic_version or no rows), the migration chain cannot run because
it only alters/adds to tables that were created by an older bootstrap. We create
tables from current SQLModel metadata and stamp head so no migrations run.
"""

import subprocess
import sys

from sqlalchemy import inspect, text

import app.models  # noqa: F401
from app.core.db import engine
from app.models import SQLModel  # noqa: F401


def is_fresh_db() -> bool:
    inspector = inspect(engine)
    if not inspector.has_table("alembic_version"):
        return True
    with engine.connect() as conn:
        r = conn.execute(text("SELECT version_num FROM alembic_version"))
        row = r.fetchone()
    return row is None


def main() -> int:
    if is_fresh_db():
        SQLModel.metadata.create_all(engine)
        return subprocess.run(
            [sys.executable, "-m", "alembic", "stamp", "head"],
            cwd=None,
        ).returncode
    return subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=None,
    ).returncode


if __name__ == "__main__":
    sys.exit(main())
