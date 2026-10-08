#!/usr/bin/env bash
# Copy the generated crontab into /etc/cron.d. Requires root (or sudo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# The deploy runs this from /opt/prudentgabriel/deploy itself, where install(1)
# refuses to copy cron-fire.sh onto itself.
if [ "$ROOT/cron-fire.sh" -ef /opt/prudentgabriel/deploy/cron-fire.sh ]; then
  chmod 0755 /opt/prudentgabriel/deploy/cron-fire.sh
else
  install -m 0755 "$ROOT/cron-fire.sh" /opt/prudentgabriel/deploy/cron-fire.sh
fi
# 0644: the file holds no secret (cron-fire.sh reads CRON_SECRET from .env.production),
# and the deploy user must be able to read it to tell whether it is current.
install -m 644 -o root -g root "$ROOT/cron.d/prudentgabriel" /etc/cron.d/prudentgabriel
echo "Installed /etc/cron.d/prudentgabriel ($(grep -c 'cron-fire.sh' /etc/cron.d/prudentgabriel) jobs)"
