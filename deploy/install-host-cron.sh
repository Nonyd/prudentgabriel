#!/usr/bin/env bash
# Copy the generated crontab into /etc/cron.d. Requires root (or sudo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
install -m 0755 "$ROOT/cron-fire.sh" /opt/prudentgabriel/deploy/cron-fire.sh
install -m 600 -o root -g root "$ROOT/cron.d/prudentgabriel" /etc/cron.d/prudentgabriel
echo "Installed /etc/cron.d/prudentgabriel ($(grep -c 'cron-fire.sh' /etc/cron.d/prudentgabriel) jobs)"
