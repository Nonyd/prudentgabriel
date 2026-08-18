#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
fi
if [ ! -f .env.staging ]; then
  cp .env.staging.example .env.staging
fi
chmod 600 .env.production .env.staging

gen_hex() { openssl rand -hex 24; }
gen_b64() { openssl rand -base64 32 | tr -d '\n'; }

set_key() {
  file="$1"
  key="$2"
  val="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}

set_if_blank() {
  file="$1"
  key="$2"
  val="$3"
  current=$(grep "^${key}=" "$file" | head -1 | cut -d= -f2- || true)
  if [ -z "$current" ] || [ "$current" = "PASSWORD" ]; then
    set_key "$file" "$key" "$val"
  fi
}

PROD_PG_PASS=$(gen_hex)
STAG_PG_PASS=$(gen_hex)
PROD_AUTH=$(gen_b64)
STAG_AUTH=$(gen_b64)
PROD_CRON=$(gen_hex)
STAG_CRON=$(gen_hex)
PROD_ENC=$(gen_hex)
STAG_ENC=$(gen_hex)

set_if_blank .env.production POSTGRES_PASSWORD "$PROD_PG_PASS"
set_if_blank .env.staging POSTGRES_PASSWORD "$STAG_PG_PASS"

prod_pass=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d= -f2-)
stag_pass=$(grep "^POSTGRES_PASSWORD=" .env.staging | cut -d= -f2-)

set_if_blank .env.production NEXTAUTH_SECRET "$PROD_AUTH"
set_if_blank .env.production AUTH_SECRET "$PROD_AUTH"
set_if_blank .env.staging NEXTAUTH_SECRET "$STAG_AUTH"
set_if_blank .env.staging AUTH_SECRET "$STAG_AUTH"
set_if_blank .env.production CRON_SECRET "$PROD_CRON"
set_if_blank .env.staging CRON_SECRET "$STAG_CRON"
set_if_blank .env.production ENCRYPTION_KEY "$PROD_ENC"
set_if_blank .env.production SETTINGS_ENCRYPTION_KEY "$PROD_ENC"
set_if_blank .env.staging ENCRYPTION_KEY "$STAG_ENC"
set_if_blank .env.staging SETTINGS_ENCRYPTION_KEY "$STAG_ENC"

set_key .env.production DATABASE_URL "postgresql://pa_prod:${prod_pass}@prudentgabriel-postgres:5432/prudentgabriel"
set_key .env.production DIRECT_URL "postgresql://pa_prod:${prod_pass}@prudentgabriel-postgres:5432/prudentgabriel"
set_key .env.staging DATABASE_URL "postgresql://pa_staging:${stag_pass}@prudentgabriel-staging-postgres:5432/prudentgabriel_staging"
set_key .env.staging DIRECT_URL "postgresql://pa_staging:${stag_pass}@prudentgabriel-staging-postgres:5432/prudentgabriel_staging"

set_if_blank .env.production RUN_DB_SEED_ON_START "safe"

echo "Env files ready."
grep -E '^[A-Z0-9_]+=' .env.production | cut -d= -f1
