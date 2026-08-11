#!/bin/bash
# Run ONCE as root:
#   bash /home/deploy/prudentgabriel/deploy/bootstrap-root.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Must run as root" >&2
  exit 1
fi

SRC="${SRC:-/home/deploy/prudentgabriel/deploy}"
DEST="${DEST:-/opt/prudentgabriel/deploy}"

if [ ! -d "$SRC" ]; then
  echo "Missing $SRC — clone the repo as deploy first." >&2
  exit 1
fi

usermod -aG docker deploy
mkdir -p "$DEST"

# Copy compose/traefik without clobbering live env files already in DEST
rsync -a --exclude ".env.production" --exclude ".env.staging" "$SRC/" "$DEST/"

if [ ! -f "$DEST/.env.production" ]; then
  cp "$SRC/.env.production" "$DEST/.env.production"
fi
if [ ! -f "$DEST/.env.staging" ]; then
  cp "$SRC/.env.staging" "$DEST/.env.staging"
fi

chmod 600 "$DEST/.env.production" "$DEST/.env.staging"
chown -R deploy:deploy /opt/prudentgabriel

if [ -d /data/coolify/proxy/dynamic ]; then
  install -m 0644 "$DEST/traefik/pg-compose-stacks.yaml" \
    /data/coolify/proxy/dynamic/pg-compose-stacks.yaml
  echo "Installed Traefik file provider."
else
  echo "WARNING: /data/coolify/proxy/dynamic not found — copy Traefik file manually."
fi

echo
echo "Bootstrap done. deploy is now in the docker group (new SSH session required)."
echo "After GHCR images exist:"
echo "  su - deploy"
echo "  cd $DEST"
echo "  docker compose --env-file .env.staging -f compose.staging.yaml pull"
echo "  docker compose --env-file .env.staging -f compose.staging.yaml up -d"
echo "  docker compose --env-file .env.production -f compose.production.yaml pull"
echo "  docker compose --env-file .env.production -f compose.production.yaml up -d"
