#!/bin/bash
# Restore production Postgres onto staging Postgres, then migrate + Slice X media.
# Does not touch production compose, .env.production, or the production app.
# Does not copy from Neon.
#
# Run on the VPS as deploy:
#   bash /opt/prudentgabriel/deploy/restore-staging-from-prod.sh
set -euo pipefail

DEPLOY_DIR=/opt/prudentgabriel/deploy
cd "$DEPLOY_DIR"

mask() { sed -E 's#://([^:/]+):[^@]+@#://\1:***@#'; }

STG_APP=prudentgabriel-staging
STG_PG=prudentgabriel-staging-postgres
PROD_PG=prudentgabriel-postgres
PROD_USER=pa_prod
PROD_DB=prudentgabriel

STG_USER=$(grep '^POSTGRES_USER=' .env.staging | head -1 | cut -d= -f2-)
STG_DB=$(grep '^POSTGRES_DB=' .env.staging | head -1 | cut -d= -f2-)
APP_DB_URL=$(docker exec "$STG_APP" printenv DATABASE_URL)
APP_DIRECT=$(docker exec "$STG_APP" printenv DIRECT_URL)

echo "== staging app DATABASE_URL=$(printf '%s' "$APP_DB_URL" | mask)"
echo "== staging app DIRECT_URL=$(printf '%s' "$APP_DIRECT" | mask)"

case "$APP_DB_URL" in
  *neon.tech*|*neon.com*|*aws.neon*)
    echo "FATAL: staging container DATABASE_URL points at Neon. Refusing to restore onto VPS Postgres." >&2
    exit 1
    ;;
esac
case "$APP_DB_URL" in
  *@"$STG_PG":*)
    ;;
  *)
    echo "FATAL: staging DATABASE_URL host is not $STG_PG. Restore would miss the database the app reads." >&2
    exit 1
    ;;
esac

BACKUP_DIR=${BACKUP_DIR:-/home/deploy/prudentgabriel-backups}
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
STG_DUMP="$BACKUP_DIR/pg-staging-before-prod-restore-$STAMP.dump"
PROD_DUMP="$BACKUP_DIR/pg-prod-for-staging-$STAMP.dump"
CREDS="$BACKUP_DIR/staging-credential-settings-$STAMP.csv"

echo "== backup staging → $STG_DUMP"
docker exec "$STG_PG" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' > "$STG_DUMP"
ls -lh "$STG_DUMP"

echo "== keep staging credential SiteSetting rows (staging ENCRYPTION_KEY cannot decrypt production ciphertext)"
docker exec "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -c "\copy (
  SELECT id, key, value, \"group\", label, type, \"isPublic\", \"sortOrder\", \"updatedAt\", \"updatedBy\"
  FROM \"SiteSetting\"
  WHERE type = 'PASSWORD'
     OR key LIKE 'paystack%'
     OR key LIKE 'flutterwave%'
     OR key LIKE 'stripe%'
     OR key LIKE 'monnify%'
     OR key LIKE 'smtp_%'
     OR key LIKE 'resend%'
     OR key LIKE 'brevo%'
     OR key LIKE 'bank_%'
     OR key ILIKE '%api_key%'
     OR key ILIKE '%webhook%'
     OR key ILIKE '%secret%'
     OR key ILIKE '%password%'
     OR key ILIKE '%token%'
) TO STDOUT WITH CSV" > "$CREDS"
echo "credential rows=$(wc -l < "$CREDS")"

echo "== dump production (read-only) → $PROD_DUMP"
docker exec "$PROD_PG" pg_dump -U "$PROD_USER" -d "$PROD_DB" -Fc --no-owner --no-acl > "$PROD_DUMP"
ls -lh "$PROD_DUMP"

echo "== stop staging app"
docker compose --env-file .env.staging -f compose.staging.yaml stop app

echo "== drop and recreate $STG_DB"
docker exec "$STG_PG" psql -U "$STG_USER" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$STG_DB' AND pid <> pg_backend_pid();"
docker exec "$STG_PG" dropdb -U "$STG_USER" --if-exists "$STG_DB"
docker exec "$STG_PG" createdb -U "$STG_USER" "$STG_DB"

echo "== restore production dump onto staging"
set +e
docker exec -i "$STG_PG" pg_restore -U "$STG_USER" --no-owner --no-acl --role="$STG_USER" -d "$STG_DB" < "$PROD_DUMP"
RESTORE_RC=$?
set -e
if [ "$RESTORE_RC" -gt 1 ]; then
  echo "FATAL: pg_restore exit $RESTORE_RC" >&2
  exit "$RESTORE_RC"
fi
if [ "$RESTORE_RC" -eq 1 ]; then
  echo "pg_restore reported warnings (exit 1) — continuing after count check"
fi

PROD_PRODUCTS=$(docker exec "$PROD_PG" psql -U "$PROD_USER" -d "$PROD_DB" -Atc 'SELECT count(*) FROM "Product"')
STG_PRODUCTS=$(docker exec "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -Atc 'SELECT count(*) FROM "Product"')
echo "products prod=$PROD_PRODUCTS staging=$STG_PRODUCTS"
if [ "$STG_PRODUCTS" != "$PROD_PRODUCTS" ]; then
  echo "FATAL: product count mismatch after restore" >&2
  exit 1
fi

if [ -s "$CREDS" ]; then
  echo "== overlay staging credential settings"
  docker exec "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -v ON_ERROR_STOP=1 -c \
    'CREATE TABLE _restore_creds (
       id text, key text, value text, "group" text, label text, type text,
       "isPublic" boolean, "sortOrder" int, "updatedAt" timestamptz, "updatedBy" text
     );'
  docker exec -i "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -c "\copy _restore_creds FROM STDIN WITH CSV" < "$CREDS"
  docker exec -i "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "SiteSetting" AS t
SET value = k.value,
    type = k.type::"SettingType",
    "updatedAt" = CURRENT_TIMESTAMP
FROM _restore_creds k
WHERE t.key = k.key;

INSERT INTO "SiteSetting" (id, key, value, "group", label, type, "isPublic", "sortOrder", "updatedAt", "updatedBy")
SELECT k.id, k.key, k.value, k."group"::"SettingGroup", k.label, k.type::"SettingType",
       k."isPublic", k."sortOrder", k."updatedAt", k."updatedBy"
FROM _restore_creds k
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" t WHERE t.key = k.key);

DROP TABLE _restore_creds;
SQL
fi

echo "== start staging app (entrypoint runs prisma migrate deploy)"
docker compose --env-file .env.staging -f compose.staging.yaml up -d --force-recreate app

echo "== wait for Next.js"
ok=0
for i in $(seq 1 90); do
  if docker logs "$STG_APP" 2>&1 | grep -q 'Starting Next.js'; then
    ok=1
    break
  fi
  if docker logs "$STG_APP" 2>&1 | grep -q 'FATAL'; then
    docker logs "$STG_APP" --tail 80 >&2
    echo "FATAL: staging app failed to boot" >&2
    exit 1
  fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  docker logs "$STG_APP" --tail 80 >&2
  echo "FATAL: timed out waiting for staging app" >&2
  exit 1
fi

echo "== migrate deploy result (from logs)"
docker logs "$STG_APP" 2>&1 | grep -E 'entrypoint|migrate|Applied|No pending' | tail -30 || true

echo "== Slice X media migrate --apply (Cloudinary → MEDIA_ROOT)"
docker compose --env-file .env.staging -f compose.staging.yaml exec -T app \
  tsx --tsconfig tsconfig.scripts.json scripts/migrate-cloudinary-media.ts --apply

echo "== post-restore counts"
docker exec "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -c '
SELECT
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Product" WHERE "isPublished") AS published,
  (SELECT count(*) FROM "ProductImage") AS images,
  (SELECT count(*) FROM "ProductImage" WHERE url LIKE '\''%/media/%'\'') AS images_local,
  (SELECT count(*) FROM "ProductImage" WHERE url LIKE '\''%cloudinary%'\'') AS images_cloudinary,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "BespokeOrder") AS bespoke,
  (SELECT count(*) FROM "ConsultationBooking") AS consults,
  (SELECT count(*) FROM "Payment") AS payments;
'

echo "== staging-only AC should now be applied"
docker exec "$STG_PG" psql -U "$STG_USER" -d "$STG_DB" -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%slice_ac%' OR migration_name LIKE '%slice_ad%' ORDER BY 1;"

echo "done. staging dump kept at $STG_DUMP"
echo "production dump copy at $PROD_DUMP"
