/**
 * Runs the test scripts that need no database, one after another, and fails
 * if any of them fails. Used by .github/workflows/ci.yml.
 *
 *   pnpm test:ci
 *
 * Only add scripts here that pass with DATABASE_URL pointing nowhere.
 */
import { spawnSync } from "node:child_process";

const TESTS = [
  "test-bespoke-balance-bind",
  "test-token-rate-limits",
  "test-not-found-status",
  "test-search-indexing",
  "test-security-headers",
  "test-client-ip",
  "test-staff-data-access",
  "test-upload-limits",
  "test-ssrf-guard",
  "test-session-revocation",
  "test-token-defaults",
  "test-hero-video",
  "test-secrets-at-rest",
  "test-legal-figures",
  "test-orderability",
  "test-product-visibility",
  "test-signin-errors",
  "test-cron-registry",
  "test-slice-ab",
  "test-slice-ad",
  "test-slice-ad2",
  "test-slice-ad2b",
  "test-slice-ad3",
  "test-slice-ah",
  "test-slice-az12",
  "test-slice-ba",
  "test-slice-bb",
  "test-slice-j",
  "test-slice-m",
  "test-slice-n",
  "test-slice-s",
  "test-slice-x",
  "test-slice-z4",
];

const failed = [];
for (const name of TESTS) {
  console.log(`\n▶ ${name}`);
  const r = spawnSync(
    "npx",
    ["tsx", "--tsconfig", "tsconfig.scripts.json", `scripts/${name}.ts`],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (r.status !== 0) failed.push(name);
}

if (failed.length) {
  console.error(`\n✗ ${failed.length} failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`\n✓ ${TESTS.length} test scripts passed`);
