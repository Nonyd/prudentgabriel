/**
 * Render deploy/cron.d/prudentgabriel from CRON_CATALOG.
 * Run: pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/render-host-cron.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CRON_CATALOG } from "../src/lib/cron/catalog";

export const HOST_CRON_FIRE = "/opt/prudentgabriel/deploy/cron-fire.sh";
export const HOST_CRON_PATH = "deploy/cron.d/prudentgabriel";

export function renderHostCronFile(): string {
  const lines = [
    "# Generated from prudential-atelier/src/lib/cron/catalog.ts. Do not edit.",
    "# Regenerate: cd prudential-atelier && pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/render-host-cron.ts",
    "#",
    "# Production schedule (UTC). CRON_SECRET is not in this file — cron-fire.sh",
    "# reads it from /opt/prudentgabriel/deploy/.env.production.",
    "#",
    "# Install (needs root):",
    "#   sudo install -m 0755 deploy/cron-fire.sh /opt/prudentgabriel/deploy/cron-fire.sh",
    "#   sudo install -m 600 -o root -g root deploy/cron.d/prudentgabriel /etc/cron.d/prudentgabriel",
    "SHELL=/bin/bash",
    "PATH=/usr/bin:/bin",
    "MAILTO=\"\"",
    "CRON_TZ=UTC",
    "",
  ];

  for (const job of CRON_CATALOG) {
    lines.push(`${job.schedule} root ${HOST_CRON_FIRE} ${job.name}`);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const out = resolve(__dirname, "../..", HOST_CRON_PATH);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderHostCronFile(), "utf8");
  console.log(`Wrote ${out} (${CRON_CATALOG.length} jobs)`);
}

const invoked = process.argv[1]?.replace(/\\/g, "/").includes("render-host-cron");
if (invoked) {
  main();
}
