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

BACKUPS_DIR="${ROOT}/backups"
mkdir -p "$BACKUPS_DIR"

OUTPUT="${BACKUPS_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-postgres}" --clean --if-exists "${POSTGRES_DB:-quartermaster_api}" > "$OUTPUT"
echo "Backup written to ${OUTPUT}"
