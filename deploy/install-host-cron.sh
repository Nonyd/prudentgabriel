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
install -m 600 -o root -g root "$ROOT/cron.d/prudentgabriel" /etc/cron.d/prudentgabriel
echo "Installed /etc/cron.d/prudentgabriel ($(grep -c 'cron-fire.sh' /etc/cron.d/prudentgabriel) jobs)"
