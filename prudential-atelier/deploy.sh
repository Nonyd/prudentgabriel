#!/bin/bash
# Local/PM2 helper only. Production uses Compose + GHCR — see ../deploy/DEPLOY.md
set -euo pipefail

ROOT="${PRUDENTIAL_ATELIER_ROOT:-$(cd "$(dirname "$0")" && pwd)}"
cd "$ROOT"

git pull origin main
pnpm install
pnpm prisma generate
pnpm build
pm2 restart prudentgabriel || pm2 start npm --name prudentgabriel -- start
echo "Deploy complete."
