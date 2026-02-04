#! /usr/bin/env bash

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . .env
  set +a
fi

BACKUPS_DIR="/root/code/backups/db"
mkdir -p "$BACKUPS_DIR"

echo "Running VACUUM ANALYZE..."
docker compose exec -T db psql -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-quartermaster_api}" -c "VACUUM ANALYZE;"

OUTPUT="${BACKUPS_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-postgres}" --clean --if-exists "${POSTGRES_DB:-quartermaster_api}" > "$OUTPUT"
echo "Backup written to ${OUTPUT}"
