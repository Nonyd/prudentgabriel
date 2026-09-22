/**
 * Slice AZ7: the re-host fetch refuses private, loopback, link-local and
 * metadata addresses (literal IPs and via DNS), and the admin
 * re-host endpoints are gone.
 *
 *   pnpm test:ssrf-guard
 *
 * Redirect hops reuse the same guarded connection; a live redirect to a private
 * address is not exercised here (any local test server is itself loopback).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { UnsafeUrlError, isBlockedAddress, safeFetchBuffer } from "../src/lib/http/safe-fetch";
import { classifyMediaUrl } from "../src/lib/media/migrate-plan";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function refused(url: string, why: string) {
  try {
    await safeFetchBuffer(url, { timeoutMs: 5_000 });
  } catch (e) {
    assert(e instanceof UnsafeUrlError, `${why}: expected UnsafeUrlError, got ${e}`);
    console.log(`ok refused ${why}: ${url}`);
    return;
  }
  throw new Error(`FAIL: ${why} was fetched: ${url}`);
}

async function main() {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254",
  ]) {
    assert(isBlockedAddress(ip), `${ip} is blocked`);
  }
  for (const ip of ["104.16.0.1", "8.8.8.8", "2606:4700::1"]) assert(!isBlockedAddress(ip), `${ip} is allowed`);
  console.log("ok address classification");

  await refused("https://169.254.169.254/latest/meta-data/", "cloud metadata IP");
  await refused("https://127.0.0.1/", "loopback IP");
  await refused("https://[::1]/", "IPv6 loopback");
  await refused("https://10.0.0.5/x.jpg", "private IP");
  await refused("https://localhost/x.jpg", "a name that resolves to loopback");
  await refused("http://example.com/x.jpg", "plain http");
  await refused("https://user:pw@example.com/x.jpg", "credentials in URL");

  // Cloudinary is matched by exact host, not substring.
  assert(classifyMediaUrl("https://res.cloudinary.com/demo/image/upload/x.jpg").action === "copy", "real Cloudinary copies");
  assert(classifyMediaUrl("https://169.254.169.254/?res.cloudinary.com").action !== "copy", "substring trick is not Cloudinary");
  assert(classifyMediaUrl("https://res.cloudinary.com.evil.example/x.jpg").action !== "copy", "look-alike host is not Cloudinary");

  // The admin re-host endpoints are removed (unused since Slice X).
  const root = path.join(__dirname, "..");
  for (const rel of [
    "src/app/api/admin/products/[id]/images/reupload/route.ts",
    "src/app/api/admin/products/migrate-images/route.ts",
    "src/lib/product-image-migrate.ts",
  ]) {
    assert(!existsSync(path.join(root, rel)), `${rel} is removed`);
  }
  assert(readFileSync(path.join(root, "scripts/migrate-cloudinary-media.ts"), "utf8").includes("safeFetchBuffer("), "CLI migration uses the guarded fetch");
  console.log("OK test-ssrf-guard");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
