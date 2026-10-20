/**
 * Staging never emails anyone outside the allowlist.
 *
 *   pnpm test:email-staging-guard
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedWhileBlocked, isEmailDeliveryBlocked, keepAllowed } from "../src/lib/email-staging-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

assert(isEmailDeliveryBlocked(env({ NEXT_PUBLIC_APP_URL: "https://staging.prudentgabriel.com" })), "staging URL blocks");
assert(isEmailDeliveryBlocked(env({ APP_URL: "https://staging.prudentgabriel.com/" })), "staging APP_URL blocks");
assert(isEmailDeliveryBlocked(env({ NEXT_PUBLIC_APP_URL: "https://prudentgabriel.com", EMAIL_DELIVERY: "off" })), "EMAIL_DELIVERY=off blocks anywhere");
assert(!isEmailDeliveryBlocked(env({ NEXT_PUBLIC_APP_URL: "https://prudentgabriel.com" })), "production sends");

const allow = env({ EMAIL_STAGING_ALLOWLIST: "Me@Gmail.com, @example.test" });
assert(isAllowedWhileBlocked("me@gmail.com", allow), "an allowlisted address is sent to");
assert(isAllowedWhileBlocked("Me <ME@gmail.com>", allow), "a named address is matched");
assert(isAllowedWhileBlocked("anyone@example.test", allow), "a domain rule allows the domain");
assert(!isAllowedWhileBlocked("client@gmail.com", allow), "anyone else is not");
assert(!isAllowedWhileBlocked("me@gmail.com", env({})), "no allowlist: nobody");
assert(keepAllowed("client@gmail.com, me@gmail.com", allow) === "me@gmail.com", "only allowlisted recipients stay");
assert(keepAllowed("client@gmail.com", allow) === undefined, "none left: not sent");

const outbox = readFileSync(join(root, "src/lib/email-outbox.ts"), "utf8");
const deliver = outbox.slice(outbox.indexOf("export async function deliverEmail"));
assert(deliver.indexOf("isEmailDeliveryBlocked()") < deliver.indexOf("provider.send("), "the guard runs before any provider");
assert((outbox.match(/provider\.send\(/g) ?? []).length === 1, "deliverEmail is the only place mail leaves");
assert(
  readFileSync(join(root, "../deploy/compose.staging.yaml"), "utf8").includes('EMAIL_DELIVERY: "off"'),
  "staging compose switches email off",
);

console.log("test-email-staging-guard: ok");
