#!/bin/bash
# Daily off-box-capable backup of media volumes + Postgres.
# Local copies rotate under /opt/prudentgabriel/backups.
# If BACKUP_RCLONE_REMOTE is set (e.g. b2:prudentgabriel-backups), rclone copy runs after the tarball.
set -euo pipefail
# The dumps hold every client's name, phone, address, measurements and payments,
# and password hashes. Owner-only, set here so a nightly run cannot loosen it:
# a one-off chmod would be undone at 02:15.
umask 077
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=${BACKUP_DIR:-/home/deploy/prudentgabriel-backups}
mkdir -p "$DEST"
chmod 700 "$DEST"
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

# Off-site only once the files are encrypted: an off-site copy of a plain dump
# widens the exposure. Until BACKUP_ENCRYPTED=true is set by whoever wires the
# encryption, the remote is refused.
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  if [ "${BACKUP_ENCRYPTED:-}" != "true" ]; then
    echo "refusing off-site copy: backups are not encrypted (set BACKUP_ENCRYPTED=true only after they are)" >&2
  else
    rclone copy "$DEST" "$BACKUP_RCLONE_REMOTE" --include "*${STAMP}*"
    echo "rclone copy → $BACKUP_RCLONE_REMOTE"
  fi
fi

# Rotate local copies older than KEEP days.
find "$DEST" -type f -mtime +"$KEEP" -delete

echo "backup $STAMP done"
