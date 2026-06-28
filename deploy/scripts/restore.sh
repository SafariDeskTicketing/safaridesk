#!/bin/sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: sh deploy/scripts/restore.sh data/backups/db-YYYYmmdd-HHMMSS.sql [uploads.tar.gz]" >&2
  exit 1
fi

DB_BACKUP="$1"
UPLOADS_BACKUP="${2:-}"

docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < "$DB_BACKUP"

if [ -n "$UPLOADS_BACKUP" ]; then
  docker compose exec -T backend sh -c "rm -rf /mnt/safaridesk/*"
  docker compose exec -T backend tar -xzf - -C /mnt/safaridesk < "$UPLOADS_BACKUP"
fi
