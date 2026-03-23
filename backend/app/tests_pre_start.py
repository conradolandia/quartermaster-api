import logging
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import Engine
from sqlmodel import Session, select
from tenacity import after_log, before_log, retry, stop_after_attempt, wait_fixed

from app.core.config import settings
from app.core.db import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

max_tries = 60 * 5  # 5 minutes
wait_seconds = 1


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARN),
)
def init(db_engine: Engine) -> None:
    try:
        # Try to create session to check if DB is awake
        with Session(db_engine) as session:
            session.exec(select(1))
            # Explicitly commit to close the transaction
            session.commit()
    except Exception as e:
        logger.error(e)
        raise e


def migrate_test_database_if_configured() -> None:
    """
    When POSTGRES_DB_TEST is set, pytest uses that database (not POSTGRES_DB).
    Prestart only migrates the main DB, so apply the same migration entrypoint here.
    """
    test_db = settings.POSTGRES_DB_TEST
    if not test_db:
        return
    if test_db == settings.POSTGRES_DB:
        return
    logger.info("Applying migrations to test database %s", test_db)
    env = os.environ.copy()
    env["POSTGRES_DB"] = test_db
    script = Path(__file__).resolve().parent / "run_migrations.py"
    result = subprocess.run(
        [sys.executable, str(script)],
        env=env,
        check=False,
    )
    if result.returncode != 0:
        logger.error(
            "Migrations failed for test database %s (exit %s)",
            test_db,
            result.returncode,
        )
        raise SystemExit(result.returncode)


def main() -> None:
    logger.info("Initializing service")
    migrate_test_database_if_configured()
    init(engine)
    logger.info("Service finished initializing")


if __name__ == "__main__":
    main()
