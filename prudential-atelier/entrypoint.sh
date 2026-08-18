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
if [ "$(id -u)" = "0" ]; then
  cd "${STANDALONE_APP_DIR}"
  exec gosu nextjs node server.js
else
  cd "${STANDALONE_APP_DIR}"
  exec node server.js
fi
