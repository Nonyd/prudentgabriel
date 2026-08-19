#!/usr/bin/env bash
# POST one registry job. Used by /etc/cron.d/prudentgabriel (production).
# Secret stays in .env.production — not in the crontab.
set -euo pipefail

JOB="${1:?usage: cron-fire.sh <job-name>}"
ENV_FILE="${CRON_ENV_FILE:-/opt/prudentgabriel/deploy/.env.production}"
APP_URL="${CRON_APP_URL:-https://prudentgabriel.com}"

if [[ ! "$JOB" =~ ^[a-z0-9-]+$ ]]; then
  echo "invalid job name: $JOB" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

SECRET=""
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    CRON_SECRET=*)
      SECRET="${line#CRON_SECRET=}"
      SECRET="${SECRET%$'\r'}"
      SECRET="${SECRET#\"}"
      SECRET="${SECRET%\"}"
      SECRET="${SECRET#\'}"
      SECRET="${SECRET%\'}"
      ;;
  esac
done < "$ENV_FILE"

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET missing in $ENV_FILE" >&2
  exit 1
fi

curl -fsS -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  "${APP_URL}/api/cron/${JOB}"
