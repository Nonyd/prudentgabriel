/**
 * Loaded before every test script (`tsx --import ./scripts/test-db-guard.ts`,
 * wired into each package.json `test:*` entry and scripts/run-ci-tests.mjs;
 * scripts/test-db-guard-wiring.ts fails if one is missing).
 *
 * Staging holds real clients now. A test must never write to it — or to
 * production — and must not write to any database unless asked to. So, before
 * the test's own code runs:
 *
 *   - DATABASE_URL / DIRECT_URL pointing at staging or production: replaced
 *     with an address that cannot connect, always. ALLOW_FIXTURES does not
 *     lift this.
 *   - Any other database, without ALLOW_FIXTURES=true: replaced the same way.
 *     Unit checks still run; the first database call fails loudly.
 *
 * Prisma prefers process.env over .env files, so the replacement wins over
 * whatever .env.local holds. This guards scripts that never call
 * assertFixturesAllowed as well as those that do.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { looksLikeProductionDatabase, looksLikeStagingDatabase } from "./fixture-guard";

export const NO_DATABASE = "postgresql://no-database:refused@127.0.0.1:1/test-db-guard";

try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv") as { config: (opts: { path: string; quiet?: boolean }) => void };
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
} catch {
  /* no dotenv in the runtime image */
}

function shut(reason: string) {
  process.env.DATABASE_URL = NO_DATABASE;
  process.env.DIRECT_URL = NO_DATABASE;
  process.env.TEST_DB_GUARD = reason;
}

const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL];
if (urls.some((u) => looksLikeProductionDatabase(u))) {
  shut("production");
  console.error("[test-db-guard] DATABASE_URL points at production: database access is refused for this run.");
} else if (urls.some((u) => looksLikeStagingDatabase(u))) {
  shut("staging");
  console.error("[test-db-guard] DATABASE_URL points at staging (real clients): database access is refused for this run.");
} else if (process.env.ALLOW_FIXTURES !== "true") {
  shut("no-fixtures");
} else {
  process.env.TEST_DB_GUARD = "open";
}
