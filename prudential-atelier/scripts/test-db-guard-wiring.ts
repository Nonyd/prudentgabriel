/**
 * The test database guard cannot be left out.
 *
 *   pnpm test:db-guard
 *
 * 1. Every package.json `test:*` script that runs a TypeScript file loads
 *    scripts/test-db-guard.ts first, and so does the CI runner.
 * 2. By behaviour: a child process given staging's and production's URLs (as
 *    deploy/.env.* has them, and as a tunnel would) sees an address that cannot
 *    connect — with or without ALLOW_FIXTURES.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const unguarded = Object.entries(pkg.scripts)
  .filter(([k, v]) => k.startsWith("test:") && /\bscripts\/[\w.-]+\.ts\b/.test(v))
  .filter(([, v]) => !v.includes("--import ./scripts/test-db-guard.ts"))
  .map(([k]) => k);
assert(unguarded.length === 0, `test scripts without the database guard: ${unguarded.join(", ")}`);
assert(readFileSync("scripts/run-ci-tests.mjs", "utf8").includes("./scripts/test-db-guard.ts"), "the CI runner loads the guard");

const probe = (env: Record<string, string>) => {
  // node itself (no shell), with tsx's loader, then the guard, then the probe.
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "--import", "./scripts/test-db-guard.ts", "-e", "process.stdout.write(JSON.stringify([process.env.DATABASE_URL, process.env.TEST_DB_GUARD]))"],
    { env: { ...process.env, ...env }, encoding: "utf8" },
  );
  return JSON.parse(r.stdout.trim().split("\n").pop() || "[]") as [string, string];
};

const cases: [string, string, string][] = [
  ["staging, as deployed", "postgresql://u:p@prudentgabriel-staging-postgres:5432/prudentgabriel_staging", "staging"],
  ["staging, through a tunnel", "postgresql://u:p@localhost:5433/prudentgabriel_staging", "staging"],
  ["production, as deployed", "postgresql://u:p@prudentgabriel-postgres:5432/prudentgabriel", "production"],
  ["production, through a tunnel", "postgresql://u:p@127.0.0.1:5434/prudentgabriel", "production"],
];
for (const [label, url, why] of cases) {
  for (const allow of ["true", ""]) {
    const [seen, reason] = probe({ DATABASE_URL: url, DIRECT_URL: url, ALLOW_FIXTURES: allow });
    assert(seen.includes("127.0.0.1:1/") && reason === why, `${label}${allow ? " with ALLOW_FIXTURES" : ""}: refused (saw ${seen}, ${reason})`);
  }
}
const [scratchClosed] = probe({ DATABASE_URL: "postgresql://u:p@scratch.example:5432/dev", ALLOW_FIXTURES: "" });
assert(scratchClosed.includes("127.0.0.1:1/"), "a scratch database is closed unless ALLOW_FIXTURES=true");
const [scratchOpen, openReason] = probe({ DATABASE_URL: "postgresql://u:p@scratch.example:5432/dev", ALLOW_FIXTURES: "true" });
assert(scratchOpen.includes("scratch.example") && openReason === "open", "and open when it is");

console.log("OK test-db-guard-wiring");
