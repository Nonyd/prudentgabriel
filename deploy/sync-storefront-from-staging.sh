#!/bin/bash
# Copy storefront presentation data (logos, CMS, catalogue) from staging Postgres
# onto production Postgres. Does not copy payment secrets, orders, or customers.
#
# Run on the VPS as the deploy user. Backs up production first.
set -euo pipefail

STAGING_PG=prudentgabriel-staging-postgres
STAGING_USER=pa_staging
STAGING_DB=prudentgabriel_staging
PROD_PG=prudentgabriel-postgres
PROD_USER=pa_prod
PROD_DB=prudentgabriel

BACKUP_DIR=/opt/prudentgabriel/deploy/backups
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$BACKUP_DIR/prod-before-storefront-sync-$STAMP.dump"

echo "== backup production → $BACKUP"
docker exec "$PROD_PG" pg_dump -U "$PROD_USER" -Fc "$PROD_DB" > "$BACKUP"
ls -lh "$BACKUP"
echo "== app DATABASE_URL=$(docker exec prudentgabriel-main printenv DATABASE_URL 2>/dev/null | sed -E 's#://([^:/]+):[^@]+@#://\1:***@#' || echo unset)"

psql_prod() {
  docker exec -i "$PROD_PG" psql -U "$PROD_USER" -d "$PROD_DB" -v ON_ERROR_STOP=1 "$@"
}
psql_stag() {
  docker exec -i "$STAGING_PG" psql -U "$STAGING_USER" -d "$STAGING_DB" -v ON_ERROR_STOP=1 "$@"
}

echo "== production counts"
psql_prod -c 'SELECT
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Product" WHERE "isPublished") AS published,
  (SELECT count(*) FROM "Order") AS orders,
  (SELECT count(*) FROM "Payment") AS payments,
  (SELECT count(*) FROM "SiteSetting" WHERE key = '"'"'logo_dark'"'"' AND length(trim(value)) > 0) AS has_logo;'

echo "== copy storefront SiteSetting values (skip secrets, maintenance flag, payment keys)"
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
) TO STDOUT WITH CSV" > /tmp/storefront-settings.csv

psql_prod -c 'DROP TABLE IF EXISTS _sync_storefront_settings; CREATE TABLE _sync_storefront_settings (key text PRIMARY KEY, value text);'
psql_prod -c "\copy _sync_storefront_settings FROM STDIN WITH CSV" < /tmp/storefront-settings.csv
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

PROD_ORDERS=$(psql_prod -Atc 'SELECT count(*) FROM "Order"')
PROD_PAYMENTS=$(psql_prod -Atc 'SELECT count(*) FROM "Payment"')
echo "production orders=$PROD_ORDERS payments=$PROD_PAYMENTS"

if [ "$PROD_ORDERS" != "0" ] || [ "$PROD_PAYMENTS" != "0" ]; then
  echo "== catalogue copy skipped — production has orders or payments. Logos/CMS copied only."
  echo "== backup kept at $BACKUP"
  exit 0
fi

echo "== production has no orders/payments — replacing catalogue from staging"
DUMP=/tmp/staging-catalogue.sql
docker exec "$STAGING_PG" pg_dump -U "$STAGING_USER" -d "$STAGING_DB" \
  --data-only --no-owner --no-privileges --disable-triggers \
  -t '"Product"' \
  -t '"ProductImage"' \
  -t '"ProductVariant"' \
  -t '"ProductColor"' \
  -t '"Collection"' \
  -t '"CollectionProduct"' \
  -t '"GalleryImage"' \
  > "$DUMP"

psql_prod <<'SQL'
DELETE FROM "CartItem";
DELETE FROM "WishlistItem";
DELETE FROM "StockAlert";
DELETE FROM "Review";
DELETE FROM "BundleItem";
DELETE FROM "CollectionProduct";
DELETE FROM "ProductImage";
DELETE FROM "ProductColor";
DELETE FROM "ProductVariant";
DELETE FROM "GalleryImage";
DELETE FROM "Product";
DELETE FROM "Collection";
SQL

psql_prod < "$DUMP"

echo "== copy testimonials without user FKs"
psql_stag -c "\copy (
  SELECT id, displayName, location, body, rating, \"clientImage\", \"adminImage\",
         \"isApproved\", \"showOnHomepage\", \"productContext\", \"orderContext\", source,
         \"createdAt\", \"updatedAt\"
  FROM \"Testimonial\"
) TO STDOUT WITH CSV" > /tmp/staging-testimonials.csv || true

if [ -s /tmp/staging-testimonials.csv ]; then
  psql_prod -c 'DROP TABLE IF EXISTS _sync_testimonials; CREATE TABLE _sync_testimonials (
    id text, "displayName" text, location text, body text, rating int,
    "clientImage" text, "adminImage" text, "isApproved" boolean, "showOnHomepage" boolean,
    "productContext" text, "orderContext" text, source text,
    "createdAt" timestamptz, "updatedAt" timestamptz
  );'
  psql_prod -c "\copy _sync_testimonials FROM STDIN WITH CSV" < /tmp/staging-testimonials.csv
  psql_prod <<'SQL'
DELETE FROM "Testimonial";
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

psql_prod -c 'DELETE FROM "GalleryImage" WHERE url LIKE '"'"'%images.unsplash.com%'"'"';'

echo "== production counts after sync"
psql_prod -c 'SELECT
  (SELECT count(*) FROM "Product") AS products,
  (SELECT count(*) FROM "Product" WHERE "isPublished") AS published,
  (SELECT length(trim(value)) FROM "SiteSetting" WHERE key = '"'"'logo_dark'"'"') AS logo_dark_chars,
  (SELECT count(*) FROM "GalleryImage") AS gallery;'

# Stop planting seed rows on the next container boot.
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
