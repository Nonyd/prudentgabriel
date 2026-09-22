/**
 * The client's IP for rate limiting (Slice AZ6).
 *
 * Path: client → [Cloudflare, production only] → Traefik → app. Traefik does not
 * trust forwarded headers from the internet: it replaces X-Forwarded-For with the
 * address it actually saw, so the RIGHTMOST entry is the TCP peer. (Staging,
 * probed 2026-09-22: a spoofed X-Forwarded-For did not change the bucket.)
 *
 * - Peer inside Cloudflare's published ranges → the request came through
 *   Cloudflare, which overwrites CF-Connecting-IP → trust it.
 * - Any other peer → use the peer. A request that skips Cloudflare and hits the
 *   origin directly cannot choose its CF-Connecting-IP, because its own address
 *   is not Cloudflare's. This holds whether or not the origin firewall is closed.
 *
 * Never the leftmost X-Forwarded-For entry: the client writes that.
 */

/** https://www.cloudflare.com/ips-v4 and /ips-v6, fetched 2026-09-22. */
export const CLOUDFLARE_IPV4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];
export const CLOUDFLARE_IPV6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

type HeaderBag = { get(name: string): string | null };

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

/** Expand an IPv6 address to 8 groups of 16 bits, or null. */
export function ipv6ToGroups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  if (s.includes(".")) {
    // IPv4-mapped tail, e.g. ::ffff:1.2.3.4
    const lastColon = s.lastIndexOf(":");
    const v4 = ipv4ToInt(s.slice(lastColon + 1));
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (base.includes(":")) {
    const a = ipv6ToGroups(ip);
    const b = ipv6ToGroups(base);
    if (!a || !b) return false;
    for (let i = 0, left = bits; left > 0; i++, left -= 16) {
      const take = Math.min(16, left);
      const mask = (0xffff << (16 - take)) & 0xffff;
      if ((a[i] & mask) !== (b[i] & mask)) return false;
    }
    return true;
  }
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

export function isCloudflareIp(ip: string): boolean {
  const list = ip.includes(":") ? CLOUDFLARE_IPV6 : CLOUDFLARE_IPV4;
  return list.some((cidr) => ipInCidr(ip, cidr));
}

/** "1.2.3.4:5678" → "1.2.3.4"; "[2001:db8::1]:443" → "2001:db8::1". */
export function normalizeIp(raw: string | null | undefined): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("[")) s = s.slice(1, s.indexOf("]") > 0 ? s.indexOf("]") : undefined);
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) s = s.split(":")[0];
  if (/^::ffff:\d{1,3}(\.\d{1,3}){3}$/i.test(s)) s = s.slice(7);
  return s.toLowerCase();
}

function isIp(s: string): boolean {
  return ipv4ToInt(s) !== null || (s.includes(":") && ipv6ToGroups(s) !== null);
}

/** The address Traefik saw: rightmost X-Forwarded-For entry, else X-Real-IP. */
export function proxyPeerIp(h: HeaderBag): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => normalizeIp(p)).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && isIp(last)) return last;
  }
  const real = normalizeIp(h.get("x-real-ip"));
  return real && isIp(real) ? real : "";
}

export function clientIpFromHeaders(h: HeaderBag): string {
  const peer = proxyPeerIp(h);
  if (peer && isCloudflareIp(peer)) {
    const cf = normalizeIp(h.get("cf-connecting-ip"));
    if (cf && isIp(cf)) return cf;
  }
  return peer || "unknown";
}
