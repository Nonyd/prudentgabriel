#!/bin/sh
set -e

STANDALONE_APP_DIR="/app"
if [ ! -f "${STANDALONE_APP_DIR}/server.js" ]; then
  echo "[entrypoint] FATAL: Next standalone server.js not found at /app/server.js."
  exit 1
fi

PRISMA_CLI="prisma"
TSX_CLI="tsx"

# Same-host Postgres: Prisma migrate prefers DIRECT_URL when set.
if [ -z "${DIRECT_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  export DIRECT_URL="${DATABASE_URL}"
  echo "[entrypoint] DIRECT_URL unset — using DATABASE_URL for migrations."
fi

echo "[entrypoint] Running database migrations..."
if ! $PRISMA_CLI migrate deploy; then
  echo "[entrypoint] ERROR: prisma migrate deploy failed."
  echo "[entrypoint] Fix: check DATABASE_URL / DIRECT_URL, resolve failed rows in _prisma_migrations, then redeploy."
  if [ "${PRISMA_MIGRATE_DEPLOY_FATAL:-}" = "1" ] || [ "${PRISMA_MIGRATE_DEPLOY_FATAL:-}" = "true" ]; then
    exit 1
  fi
  echo "[entrypoint] WARNING: continuing because PRISMA_MIGRATE_DEPLOY_FATAL is not set."
fi

# Token sweep: hash any link token still stored in plaintext (idempotent; a no-op once done).
# Non-fatal so a failure cannot keep the shop down, but it is loud: old links 404 until it succeeds.
echo "[entrypoint] Hashing any plaintext capability tokens..."
$TSX_CLI --tsconfig tsconfig.scripts.json scripts/upgrade-capability-tokens.ts   || echo "[entrypoint] ERROR: upgrade-capability-tokens failed; pre-sweep links will not open until it runs."

# Key rotation: with ENCRYPTION_KEY_PREVIOUS set, rewrite every encrypted column under
# the current key. Remove the previous key only after this reports "unreadable 0".
if [ -n "${ENCRYPTION_KEY_PREVIOUS:-}" ]; then
  echo "[entrypoint] ENCRYPTION_KEY_PREVIOUS is set: re-encrypting secrets under the current key..."
  $TSX_CLI --tsconfig tsconfig.scripts.json scripts/reencrypt-secrets.ts     || echo "[entrypoint] ERROR: reencrypt-secrets found values no key can read; keep ENCRYPTION_KEY_PREVIOUS."
fi

# RUN_DB_SEED_ON_START=safe → production-safe bootstrap (settings, consultants, admin). Never demo data.
# RUN_DB_SEED_ON_START=true  → same bootstrap (seed.ts does not wipe catalogue/orders).
# unset / false              → skip.
if [ "${RUN_DB_SEED_ON_START}" = "safe" ] || [ "${RUN_DB_SEED_ON_START}" = "true" ]; then
  echo "[entrypoint] RUN_DB_SEED_ON_START=${RUN_DB_SEED_ON_START} — running bootstrap seed..."
  $TSX_CLI prisma/seed.ts || echo "[entrypoint] WARNING: bootstrap seed failed (non-fatal)."
else
  echo "[entrypoint] Skipping seed. Set RUN_DB_SEED_ON_START=safe for bootstrap seed."
fi

echo "[entrypoint] Starting Next.js (cwd ${STANDALONE_APP_DIR})..."
MEDIA_ROOT="${MEDIA_ROOT:-/data/media}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${MEDIA_ROOT}/public" "${MEDIA_ROOT}/private"
  chown -R nextjs:nodejs "${MEDIA_ROOT}"
fi
if echo "${NEXT_PUBLIC_APP_URL:-} ${APP_URL:-}" | grep -q "staging.prudentgabriel.com"; then
  export CRON_SCHEDULER="${CRON_SCHEDULER:-1}"
  export CRON_HOST="${CRON_HOST:-vps-staging}"
  echo "[entrypoint] Staging host detected — CRON_SCHEDULER=${CRON_SCHEDULER}."
fi
if [ "$(id -u)" = "0" ]; then
  cd "${STANDALONE_APP_DIR}"
  exec gosu nextjs node server.js
else
  cd "${STANDALONE_APP_DIR}"
  exec node server.js
fi
