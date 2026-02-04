#! /usr/bin/env bash

# Clears all tables in public schema except user and alembic_version.
# No "settings" table exists in the DB; app config lives in .env.

set -e

if [ "${1:-}" != "--yes" ]; then
  echo "This will delete all data except the user and alembic_version tables." >&2
  echo "Run with --yes to confirm." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . .env
  set +a
fi

USER="${POSTGRES_USER:-postgres}"
DB="${POSTGRES_DB:-quartermaster_api}"

docker compose exec -T db psql -U "$USER" "$DB" <<'SQL'
DO $$
DECLARE
  r RECORD;
  tbls text := '';
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('user', 'alembic_version')
    ORDER BY tablename
  LOOP
    tbls := tbls || quote_ident(r.tablename) || ',';
  END LOOP;
  IF tbls != '' THEN
    tbls := rtrim(tbls, ',');
    EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;
SQL

echo "Cleared all tables except user and alembic_version."
