#! /usr/bin/env bash

set -e

CLEAN=
if [ "${1:-}" = "--clean" ]; then
  CLEAN=1
  shift
fi

if [ $# -ne 1 ]; then
  echo "Usage: $0 [--clean] <backup.sql>" >&2
  echo "Example: $0 backups/backup_20250203_120000.sql" >&2
  echo "  --clean  drop public schema before restore (use if backup has no DROP statements)" >&2
  exit 1
fi

BACKUP="$1"
if [ ! -f "$BACKUP" ]; then
  echo "File not found: ${BACKUP}" >&2
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

if [ -n "$CLEAN" ]; then
  docker compose exec -T db psql -U "$USER" "$DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $USER; GRANT ALL ON SCHEMA public TO public;"
fi

docker compose exec -T db psql -U "$USER" "$DB" < "$BACKUP"
echo "Restored from ${BACKUP}"
