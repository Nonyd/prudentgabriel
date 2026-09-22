import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";
import { ipInCidr, normalizeIp } from "@/lib/http/client-ip";

/**
 * Slice AZ7 — fetch a remote file for re-hosting without SSRF.
 *
 * - HTTPS only.
 * - The host is checked when the socket connects (custom DNS lookup), not in
 *   a separate pre-check, so DNS rebinding cannot swap in a private address
 *   between the check and the connection.
 * - Refuses loopback, private, CGNAT, link-local (incl. cloud metadata
 *   169.254.169.254), multicast, reserved and unspecified addresses, IPv4 and
 *   IPv6, including IPv4-mapped IPv6.
 * - Redirects are followed manually (max 3); every hop goes through the same
 *   guarded connection.
 * - Size and time limits.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];
const BLOCKED_V6 = ["::/128", "::1/128", "fc00::/7", "fe80::/10", "ff00::/8", "2001:db8::/32", "64:ff9b::/96"];

export function isBlockedAddress(raw: string): boolean {
  const ip = normalizeIp(raw); // also unwraps ::ffff:a.b.c.d
  const v = isIP(ip);
  if (v === 4) return BLOCKED_V4.some((c) => ipInCidr(ip, c));
  if (v === 6) return BLOCKED_V6.some((c) => ipInCidr(ip, c));
  return true; // not an IP at all: refuse
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS lookup used for the actual connection: every resolved address must be public. */
function guardedLookup(hostname: string, options: object, cb: LookupCb): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, []);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad || list.length === 0) {
      return cb(new UnsafeUrlError(`Refusing ${hostname}: resolves to a non-public address`), []);
    }
    const wantsAll = (options as { all?: boolean }).all;
    if (wantsAll) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

export type SafeFetchOptions = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number };

export async function safeFetchBuffer(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<{ buffer: Buffer; contentType: string | null; finalUrl: string }> {
  const maxBytes = opts.maxBytes ?? 15 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  let redirectsLeft = opts.maxRedirects ?? 3;
  let current = url;

  for (;;) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new UnsafeUrlError("Not a valid URL");
    }
    if (parsed.protocol !== "https:") throw new UnsafeUrlError("Only https:// URLs can be fetched");
    if (parsed.username || parsed.password) throw new UnsafeUrlError("URLs with credentials are refused");
    // Literal IPs skip DNS, so check them here too.
    if (isIP(parsed.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(parsed.hostname.replace(/^\[|\]$/g, ""))) {
      throw new UnsafeUrlError(`Refusing ${parsed.hostname}: non-public address`);
    }

    const res = await new Promise<{ status: number; location: string | null; contentType: string | null; body: Buffer }>(
      (resolve, reject) => {
        const req = request(
          parsed,
          { method: "GET", lookup: guardedLookup as never, timeout: timeoutMs, headers: { "user-agent": "prudentgabriel-media/1" } },
          (r) => {
            const status = r.statusCode ?? 0;
            if (status >= 300 && status < 400) {
              r.resume();
              return resolve({ status, location: r.headers.location ?? null, contentType: null, body: Buffer.alloc(0) });
            }
            const declared = Number(r.headers["content-length"] ?? "0");
            if (declared > maxBytes) {
              r.destroy();
              return reject(new UnsafeUrlError(`Response larger than ${maxBytes} bytes`));
            }
            const chunks: Buffer[] = [];
            let total = 0;
            r.on("data", (c: Buffer) => {
              total += c.length;
              if (total > maxBytes) {
                r.destroy();
                reject(new UnsafeUrlError(`Response larger than ${maxBytes} bytes`));
                return;
              }
              chunks.push(c);
            });
            r.on("end", () =>
              resolve({ status, location: null, contentType: r.headers["content-type"] ?? null, body: Buffer.concat(chunks) }),
            );
            r.on("error", reject);
          },
        );
        req.on("timeout", () => req.destroy(new UnsafeUrlError(`Timed out after ${timeoutMs}ms`)));
        req.on("error", reject);
        req.end();
      },
    );

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`Redirect ${res.status} without Location`);
      if (redirectsLeft-- <= 0) throw new UnsafeUrlError("Too many redirects");
      current = new URL(res.location, parsed).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`Could not fetch (${res.status})`);
    return { buffer: res.body, contentType: res.contentType, finalUrl: current };
  }
}
