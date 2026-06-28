#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-data/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_DIR/db-$STAMP.sql"
docker compose exec -T backend tar -czf - -C /mnt/safaridesk . > "$BACKUP_DIR/uploads-$STAMP.tar.gz"

echo "Wrote $BACKUP_DIR/db-$STAMP.sql"
echo "Wrote $BACKUP_DIR/uploads-$STAMP.tar.gz"
