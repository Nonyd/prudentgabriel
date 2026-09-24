#!/bin/bash
# Copy house content and staff logins from staging Postgres onto production.
# Leaves orders, clients, consultations, payments, and other customer-generated
# rows empty. Does not copy payment secrets or SMTP keys.
#
# Run on the VPS as the deploy user AFTER production has the same Prisma
# migrations as staging. Backs up production first.
set -euo pipefail

STAGING_PG=prudentgabriel-staging-postgres
STAGING_USER=pa_staging
STAGING_DB=prudentgabriel_staging
PROD_PG=prudentgabriel-postgres
PROD_USER=pa_prod
PROD_DB=prudentgabriel
STAGING_MEDIA=/opt/prudentgabriel/media-staging
PROD_MEDIA=/opt/prudentgabriel/media

BACKUP_DIR=${BACKUP_DIR:-/home/deploy/prudentgabriel-backups}
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$BACKUP_DIR/prod-before-storefront-sync-$STAMP.dump"
WORK="$BACKUP_DIR/sync-work-$STAMP"
mkdir -p "$WORK"

echo "== backup production → $BACKUP"
docker exec "$PROD_PG" pg_dump -U "$PROD_USER" -Fc "$PROD_DB" > "$BACKUP"
ls -lh "$BACKUP"

psql_prod() {
  docker exec -i "$PROD_PG" psql -U "$PROD_USER" -d "$PROD_DB" -v ON_ERROR_STOP=1 "$@"
}
psql_stag() {
  docker exec -i "$STAGING_PG" psql -U "$STAGING_USER" -d "$STAGING_DB" -v ON_ERROR_STOP=1 "$@"
}

PROD_MIG=$(psql_prod -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')
STG_MIG=$(psql_stag -Atc 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')
echo "== migrations prod=$PROD_MIG staging=$STG_MIG"
if [ "$PROD_MIG" -lt "$STG_MIG" ]; then
  echo "FATAL: production schema is behind staging. Wait for the main deploy to finish migrate." >&2
  echo "== backup kept at $BACKUP" >&2
  exit 1
fi

echo "== production counts before"
psql_prod -c 'SELECT
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "BespokeOrder") AS bespoke,
  (SELECT count(*) FROM "ClientProfile") AS clients,
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "User" WHERE role::text <> '"'"'CUSTOMER'"'"' OR "isStaff") AS staff,
  (SELECT count(*) FROM "BankAccount") AS banks,
  (SELECT count(*) FROM "GalleryImage") AS gallery;'

echo "== staging staff that will be copied"
psql_stag -c 'SELECT email, role, "isStaff", "isActive" FROM "User"
WHERE role::text <> '"'"'CUSTOMER'"'"' OR "isStaff"
ORDER BY role, email;'

echo "== copy media $STAGING_MEDIA → $PROD_MEDIA via docker (uid 1001 volume)"
if [ ! -d "$STAGING_MEDIA" ]; then
  echo "FATAL: $STAGING_MEDIA missing" >&2
  exit 1
fi
MEDIA_IMAGE=$(docker inspect prudentgabriel-main --format '{{.Config.Image}}' 2>/dev/null || echo 'ghcr.io/nonyd/prudentgabriel:production')
docker run --rm --user 0 \
  -v "$STAGING_MEDIA":/src:ro \
  -v "$PROD_MEDIA":/dst \
  "$MEDIA_IMAGE" \
  sh -c 'find /dst -mindepth 1 -maxdepth 1 -exec rm -rf {} +; cp -a /src/. /dst/; chown -R 1001:1001 /dst; echo files=$(find /dst -type f | wc -l)'

echo "== overlay SiteSetting values (skip secrets, maintenance flag, payment keys)"
psql_stag -c "\copy (
  SELECT key, value FROM \"SiteSetting\"
  WHERE key <> 'maintenance_mode_enabled'
    AND key NOT LIKE 'paystack%'
    AND key NOT LIKE 'flutterwave%'
    AND key NOT LIKE 'stripe%'
    AND key NOT LIKE 'monnify%'
    AND key NOT LIKE 'smtp_%'
    AND key NOT LIKE 'resend%'
    AND key NOT LIKE 'brevo%'
    AND key NOT LIKE 'gig_%'
    AND key NOT LIKE 'dhl_%'
    AND key NOT LIKE 'bank_%'
    AND key NOT ILIKE '%secret%'
    AND key NOT ILIKE '%password%'
    AND key NOT ILIKE '%api_key%'
    AND key NOT ILIKE '%webhook%'
    AND key NOT ILIKE '%token%'
) TO STDOUT WITH CSV" > "$WORK/storefront-settings.csv"

psql_prod -c 'DROP TABLE IF EXISTS _sync_storefront_settings; CREATE TABLE _sync_storefront_settings (key text PRIMARY KEY, value text);'
psql_prod -c "\copy _sync_storefront_settings FROM STDIN WITH CSV" < "$WORK/storefront-settings.csv"
psql_prod <<'SQL'
UPDATE "SiteSetting" AS t
SET value = s.value, "updatedAt" = CURRENT_TIMESTAMP
FROM _sync_storefront_settings s
WHERE t.key = s.key;

INSERT INTO "SiteSetting" (id, key, value, "group", label, type, "isPublic", "sortOrder", "updatedAt")
SELECT
  'sync_' || substr(md5(s.key), 1, 16),
  s.key,
  s.value,
  'APPEARANCE',
  s.key,
  'TEXT',
  true,
  0,
  CURRENT_TIMESTAMP
FROM _sync_storefront_settings s
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" t WHERE t.key = s.key);

SELECT count(*) AS settings_updated FROM _sync_storefront_settings;
DROP TABLE _sync_storefront_settings;
SQL

CONTENT_TABLES=(
  BankAccount
  BlogPost
  BundleItem
  Collection
  CollectionProduct
  CollectionReel
  Consultant
  ConsultantAvailability
  ConsultantBlockedDate
  ConsultantOffering
  Coupon
  ExchangeRateSnapshot
  GalleryImage
  JobPosting
  JobRole
  LagosLocation
  LoyaltyRule
  MeasurementField
  MediaItem
  PackagingProfile
  PermissionCacheState
  PickupLocation
  Product
  ProductColor
  ProductImage
  ProductMeasurement
  ProductVariant
  RolePermission
  ShippingMethod
  ShippingZone
  SizeChart
  SizeChartRow
)

DUMP="$WORK/staging-content.sql"
DUMP_ARGS=()
for t in "${CONTENT_TABLES[@]}"; do
  DUMP_ARGS+=(-t "\"$t\"")
done

echo "== dump staging content tables"
docker exec "$STAGING_PG" pg_dump -U "$STAGING_USER" -d "$STAGING_DB" \
  --data-only --no-owner --no-privileges --disable-triggers \
  "${DUMP_ARGS[@]}" \
  > "$DUMP"
ls -lh "$DUMP"

echo "== dump staging staff users (not customers)"
psql_stag -c "\copy (
  SELECT * FROM \"User\"
  WHERE role::text <> 'CUSTOMER' OR \"isStaff\" = true
) TO STDOUT WITH CSV HEADER" > "$WORK/staging-staff-users.csv"
STAFF_ROWS=$(($(wc -l < "$WORK/staging-staff-users.csv") - 1))
echo "staff rows=$STAFF_ROWS"
if [ "$STAFF_ROWS" -lt 1 ]; then
  echo "FATAL: no staging staff users to copy" >&2
  exit 1
fi

echo "== wipe production user-generated rows and replace content + staff"
psql_prod <<'SQL'
SET session_replication_role = replica;

DO $$
DECLARE
  wipe text;
BEGIN
  SELECT string_agg(format('%I', tablename), ', ')
    INTO wipe
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN ('_prisma_migrations', 'SiteSetting');
  EXECUTE 'TRUNCATE TABLE ' || wipe || ' RESTART IDENTITY CASCADE';
END $$;

SET session_replication_role = origin;
SQL

psql_prod < "$DUMP"

echo "== strip placeholder atelier content (invented on staging for review; never live)"
psql_prod <<'SQL'
UPDATE "GalleryImage"
SET caption = NULL, description = NULL, "priceFloorNGN" = NULL, "priceCeilingNGN" = NULL, placeholder = false
WHERE placeholder = true;
SQL

psql_prod <<'SQL'
DROP TABLE IF EXISTS _sync_staff_users;
CREATE TABLE _sync_staff_users (LIKE "User" INCLUDING DEFAULTS);
SQL
psql_prod -c "\copy _sync_staff_users FROM STDIN WITH CSV HEADER" < "$WORK/staging-staff-users.csv"
psql_prod <<'SQL'
SET session_replication_role = replica;
UPDATE _sync_staff_users
SET "referredById" = NULL,
    "pointsBalance" = 0;
DELETE FROM "User";
INSERT INTO "User" SELECT * FROM _sync_staff_users;
DROP TABLE _sync_staff_users;
SET session_replication_role = origin;
SQL

echo "== copy staff profiles and permission overrides"
psql_stag -c "\copy (SELECT * FROM \"StaffProfile\") TO STDOUT WITH CSV HEADER" > "$WORK/staging-staff-profiles.csv" || true
psql_stag -c "\copy (SELECT * FROM \"UserPermission\") TO STDOUT WITH CSV HEADER" > "$WORK/staging-user-perms.csv" || true
psql_stag -c "\copy (
  SELECT id, \"displayName\", location, body, rating, \"clientImage\", \"adminImage\",
         \"isApproved\", \"showOnHomepage\", \"productContext\", \"orderContext\", source,
         \"createdAt\", \"updatedAt\"
  FROM \"Testimonial\"
) TO STDOUT WITH CSV" > "$WORK/staging-testimonials.csv" || true

if [ -s "$WORK/staging-staff-profiles.csv" ] && [ "$(wc -l < "$WORK/staging-staff-profiles.csv")" -gt 1 ]; then
  psql_prod -c 'DROP TABLE IF EXISTS _sync_staff_profiles; CREATE TABLE _sync_staff_profiles (LIKE "StaffProfile" INCLUDING DEFAULTS);'
  psql_prod -c "\copy _sync_staff_profiles FROM STDIN WITH CSV HEADER" < "$WORK/staging-staff-profiles.csv"
  psql_prod <<'SQL'
INSERT INTO "StaffProfile" SELECT * FROM _sync_staff_profiles;
DROP TABLE _sync_staff_profiles;
SQL
fi

if [ -s "$WORK/staging-user-perms.csv" ] && [ "$(wc -l < "$WORK/staging-user-perms.csv")" -gt 1 ]; then
  psql_prod -c 'DROP TABLE IF EXISTS _sync_user_perms; CREATE TABLE _sync_user_perms (LIKE "UserPermission" INCLUDING DEFAULTS);'
  psql_prod -c "\copy _sync_user_perms FROM STDIN WITH CSV HEADER" < "$WORK/staging-user-perms.csv"
  psql_prod <<'SQL'
INSERT INTO "UserPermission" SELECT * FROM _sync_user_perms;
DROP TABLE _sync_user_perms;
SQL
fi

if [ -s "$WORK/staging-testimonials.csv" ]; then
  psql_prod -c 'DROP TABLE IF EXISTS _sync_testimonials; CREATE TABLE _sync_testimonials (
    id text, "displayName" text, location text, body text, rating int,
    "clientImage" text, "adminImage" text, "isApproved" boolean, "showOnHomepage" boolean,
    "productContext" text, "orderContext" text, source text,
    "createdAt" timestamptz, "updatedAt" timestamptz
  );'
  psql_prod -c "\copy _sync_testimonials FROM STDIN WITH CSV" < "$WORK/staging-testimonials.csv"
  psql_prod <<'SQL'
INSERT INTO "Testimonial" (
  id, "userId", "displayName", location, body, rating, "clientImage", "adminImage",
  "isApproved", "showOnHomepage", "productContext", "orderContext", source, "createdAt", "updatedAt"
)
SELECT
  id, NULL, "displayName", location, body, rating, "clientImage", "adminImage",
  "isApproved", "showOnHomepage", "productContext", "orderContext", COALESCE(source, 'CLIENT'),
  "createdAt", "updatedAt"
FROM _sync_testimonials;
DROP TABLE _sync_testimonials;
SQL
fi

psql_prod <<'SQL'
UPDATE "Product" SET "orderCount" = 0;
UPDATE "Coupon" SET "usedCount" = 0;
SQL

rm -rf "$WORK"

echo "== production counts after sync"
psql_prod -c 'SELECT
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Product" WHERE "isPublished") AS published,
  (SELECT count(*) FROM "ProductImage") AS images,
  (SELECT count(*) FROM "Collection") AS collections,
  (SELECT count(*) FROM "GalleryImage") AS gallery,
  (SELECT count(*) FROM "BlogPost") AS posts,
  (SELECT count(*) FROM "BankAccount") AS banks,
  (SELECT count(*) FROM "JobPosting") AS jobs,
  (SELECT count(*) FROM "Consultant") AS consultants,
  (SELECT count(*) FROM "ShippingZone") AS ship_zones,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "BespokeOrder") AS bespoke,
  (SELECT count(*) FROM "ClientProfile") AS clients,
  (SELECT count(*) FROM "ConsultationBooking") AS consults,
  (SELECT count(*) FROM "Payment") AS payments,
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "User" WHERE role::text = '"'"'CUSTOMER'"'"') AS customers;'

echo "== production staff after sync"
psql_prod -c 'SELECT email, role, "isStaff", "isActive", (password IS NOT NULL) AS has_password
FROM "User" ORDER BY role, email;'

ENV_FILE=/opt/prudentgabriel/deploy/.env.production
if [ -f "$ENV_FILE" ]; then
  if grep -q '^RUN_DB_SEED_ON_START=' "$ENV_FILE"; then
    sed -i 's/^RUN_DB_SEED_ON_START=.*/RUN_DB_SEED_ON_START=false/' "$ENV_FILE"
  else
    printf '\nRUN_DB_SEED_ON_START=false\n' >> "$ENV_FILE"
  fi
  echo "== RUN_DB_SEED_ON_START=false in .env.production"
fi

echo "== done. backup: $BACKUP"
