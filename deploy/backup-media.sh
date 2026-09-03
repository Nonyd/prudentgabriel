#!/bin/bash
# Daily off-box-capable backup of media volumes + Postgres.
# Local copies rotate under /opt/prudentgabriel/backups.
# If BACKUP_RCLONE_REMOTE is set (e.g. b2:prudentgabriel-backups), rclone copy runs after the tarball.
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=${BACKUP_DIR:-/opt/prudentgabriel/backups}
mkdir -p "$DEST"
KEEP=${BACKUP_KEEP:-14}

backup_tree() {
  local name="$1"
  local src="$2"
  if [ ! -d "$src" ]; then
    echo "skip $name — $src missing"
    return 0
  fi
  tar -C "$(dirname "$src")" -czf "$DEST/${name}-${STAMP}.tar.gz" "$(basename "$src")"
  echo "wrote $DEST/${name}-${STAMP}.tar.gz"
}

backup_tree media-staging /opt/prudentgabriel/media-staging
backup_tree media /opt/prudentgabriel/media

dump_pg() {
  local container="$1"
  local out="$2"
  if docker ps --format '{{.Names}}' | grep -qx "$container"; then
    docker exec "$container" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$out"
    echo "wrote $out"
  fi
}
dump_pg prudentgabriel-staging-postgres "$DEST/pg-staging-${STAMP}.dump"
dump_pg prudentgabriel-postgres "$DEST/pg-prod-${STAMP}.dump"

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "$DEST" "$BACKUP_RCLONE_REMOTE" --include "*${STAMP}*"
  echo "rclone copy → $BACKUP_RCLONE_REMOTE"
fi

# Rotate local copies older than KEEP days.
find "$DEST" -type f -mtime +"$KEEP" -delete

echo "backup $STAMP done"
