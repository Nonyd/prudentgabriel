/**
 * Fails when Cloudflare's published IP ranges differ from the snapshot in
 * src/lib/http/client-ip.ts (Slice AZ6). A visitor arriving through a range the
 * snapshot lacks would be rate-limited under Cloudflare's address again — every
 * such visitor sharing one bucket. Run monthly by .github/workflows/cloudflare-ips.yml.
 *
 *   node scripts/check-cloudflare-ips.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "..", "src/lib/http/client-ip.ts"), "utf8");

function snapshot(name) {
  const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`).exec(src);
  if (!m) throw new Error(`${name} not found in client-ip.ts`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

async function published(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.text()).split(/\s+/).filter(Boolean).sort();
}

let drift = false;
for (const [name, url] of [
  ["CLOUDFLARE_IPV4", "https://www.cloudflare.com/ips-v4"],
  ["CLOUDFLARE_IPV6", "https://www.cloudflare.com/ips-v6"],
]) {
  const mine = snapshot(name);
  const theirs = await published(url);
  const added = theirs.filter((c) => !mine.includes(c));
  const removed = mine.filter((c) => !theirs.includes(c));
  if (added.length || removed.length) {
    drift = true;
    console.error(`${name} drifted. Add: ${added.join(", ") || "—"}. Remove: ${removed.join(", ") || "—"}.`);
  } else {
    console.log(`${name} matches ${url} (${mine.length} ranges)`);
  }
}
if (drift) {
  console.error("Update CLOUDFLARE_IPV4 / CLOUDFLARE_IPV6 in src/lib/http/client-ip.ts.");
  process.exit(1);
}
