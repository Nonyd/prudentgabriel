/**
 * Slice AZ1–AZ2 — Next AVIF mitigation + Auth.js patch pins.
 *
 *   pnpm test:slice-az12
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
const nextConfig = readFileSync(join(root, "next.config.mjs"), "utf8");
const middleware = readFileSync(join(root, "src/middleware.ts"), "utf8");

assert(pkg.dependencies.next === "14.2.35", "Next stays on 14.2.35 (no 15 jump in AZ)");
assert(
  /formats:\s*\[\s*["']image\/webp["']\s*\]/.test(nextConfig),
  "formats is WebP-only (AVIF off for GHSA-2xp9-vwfh-vxw4)",
);
assert(!/formats:\s*\[[^\]]*image\/avif/.test(nextConfig), "formats array must not include AVIF");
assert(nextConfig.includes("GHSA-2xp9-vwfh-vxw4"), "config cites the advisory");
assert(/MITIGATED,\s*NOT FIXED/i.test(nextConfig), "config states mitigated not fixed");

const sharpVer = JSON.parse(readFileSync(join(root, "node_modules/sharp/package.json"), "utf8")).version as string;
assert(/^0\.35\.(?:[4-9]|\d{2,})/.test(sharpVer) || /^0\.(3[6-9]|[4-9])/.test(sharpVer), `sharp is patched (≥0.35.4), got ${sharpVer}`);
const raster = readFileSync(join(root, "src/lib/receipt-raster.ts"), "utf8");
assert(!/from\s+["']heic-convert["']/.test(raster), "receipt raster must not import heic-convert");
assert(!pkg.dependencies["heic-convert"], "heic-convert removed from dependencies");
assert(raster.includes("GHSA-rgj7-g3m4-5g8c") || raster.includes("0.35.4"), "receipt raster cites the sharp/libheif advisory");

assert(pkg.dependencies["next-auth"] === "5.0.0-beta.32", "next-auth pinned to patched beta.32");
assert(pkg.dependencies["@auth/core"] === "0.41.3", "@auth/core pinned to patched 0.41.3");

const nextAuthVer = require("next-auth/package.json").version as string;
const authCoreVer = JSON.parse(
  readFileSync(join(root, "node_modules/@auth/core/package.json"), "utf8"),
).version as string;
assert(nextAuthVer === "5.0.0-beta.32", `installed next-auth is ${nextAuthVer}`);
assert(authCoreVer === "0.41.3", `installed @auth/core is ${authCoreVer}`);

assert(
  middleware.includes("request.auth?.user ? request.auth : null"),
  "middleware fails closed unless session has a user (GHSA-8fpg-xm3f-6cx3 defense)",
);

console.log("OK — AZ1 AVIF off on Next 14.2.35; AZ2 next-auth@5.0.0-beta.32 + @auth/core@0.41.3");
