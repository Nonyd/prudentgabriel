#!/bin/bash
# Daily off-box-capable backup of media volumes + Postgres.
# Restore drill and recovery runbook: DEPLOY.md → "Restore from backup".
#
# Environment (root's crontab line):
#   BACKUP_DIR            where the files go (default /home/deploy/prudentgabriel-backups;
#                         recommended /var/backups/prudentgabriel, root-only)
#   BACKUP_KEEP           days kept locally (default 14 — not a decided period, see
#                         prudential-atelier/docs/LEGAL_OPEN_QUESTIONS.md item 9)
#   BACKUP_AGE_RECIPIENT  age public key (age1…). When set, every dump and archive is
#                         streamed through `age` and only ciphertext reaches the disk.
#                         The private key never lives on this server.
#   BACKUP_RCLONE_REMOTE  off-site target; used only when the files are encrypted.
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

RECIPIENT=${BACKUP_AGE_RECIPIENT:-}
if [ -n "$RECIPIENT" ]; then
  if ! command -v age >/dev/null 2>&1; then
    # Never fall back to plaintext because a tool went missing.
    echo "BACKUP_AGE_RECIPIENT is set but age is not installed — no backup written" >&2
    exit 1
  fi
  EXT=".age"
else
  EXT=""
fi

# stdin → $1, encrypted when a recipient is set. The partial file is removed on failure.
write_out() {
  local out="$1"
  if [ -n "$RECIPIENT" ]; then
    age -r "$RECIPIENT" -o "$out" || { rm -f "$out"; return 1; }
  else
    cat > "$out" || { rm -f "$out"; return 1; }
  fi
}

backup_tree() {
  local name="$1"
  local src="$2"
  if [ ! -d "$src" ]; then
    echo "skip $name — $src missing"
    return 0
  fi
  # Includes media/private (receipts, consultation uploads): the proof behind the payment rows.
  local out="$DEST/${name}-${STAMP}.tar.gz${EXT}"
  tar -C "$(dirname "$src")" -cz "$(basename "$src")" | write_out "$out"
  echo "wrote $out"
}

backup_tree media-staging /opt/prudentgabriel/media-staging
backup_tree media /opt/prudentgabriel/media

dump_pg() {
  local container="$1"
  local out="$2${EXT}"
  if docker ps --format '{{.Names}}' | grep -qx "$container"; then
    docker exec "$container" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' | write_out "$out"
    echo "wrote $out"
  fi
}
dump_pg prudentgabriel-staging-postgres "$DEST/pg-staging-${STAMP}.dump"
dump_pg prudentgabriel-postgres "$DEST/pg-prod-${STAMP}.dump"

# Off-site only when the files are encrypted: an off-site copy of a plain dump
# widens the exposure rather than reducing it.
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  if [ -z "$RECIPIENT" ]; then
    echo "refusing off-site copy: backups are not encrypted (set BACKUP_AGE_RECIPIENT first)" >&2
  else
    rclone copy "$DEST" "$BACKUP_RCLONE_REMOTE" --include "*${STAMP}*"
    echo "rclone copy → $BACKUP_RCLONE_REMOTE"
  fi
fi

# Rotate local copies older than KEEP days.
find "$DEST" -type f -mtime +"$KEEP" -delete

echo "backup $STAMP done"
