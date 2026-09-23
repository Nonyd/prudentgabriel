import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { decrypt, encrypt } from "@/lib/encryption";

/** 32-byte raw tokens, URL-safe base64 (no padding). */
export const CAPABILITY_TOKEN_BYTES = 32;

/**
 * TTLs for newly issued capability links (AZ3).
 * Links issued before AZ3 have null *ExpiresAt and stay valid; since the token
 * sweep their stored value is a hash like every other (scripts/upgrade-capability-tokens.ts).
 */
export const CAPABILITY_TTL_MS = {
  /** Stage design approval — a fortnight. */
  stageApproval: 14 * 24 * 60 * 60 * 1000,
  /**
   * Receipt confirm — alteration window (30 days) plus margin after the
   * delivery email goes out. Set when delivery completes, not at order create.
   */
  receiptConfirm: 45 * 24 * 60 * 60 * 1000,
  /** Tracking across a long commission. */
  track: 180 * 24 * 60 * 60 * 1000,
  /** After invoice document expiry (or paidAt), keep the link this long. */
  invoiceAfterDocument: 90 * 24 * 60 * 60 * 1000,
  /**
   * BA2: booking link on an approved enquiry — a fortnight, like stage approval.
   * Long enough to agree dates at home; short enough that a forwarded link dies.
   * The house can re-send a fresh one.
   */
  consultationBooking: 14 * 24 * 60 * 60 * 1000,
  /** Staff invitation: three days, as the email has always said. */
  teamInvite: 72 * 60 * 60 * 1000,
  /** Abandoned-checkout restore link: the reminders run over days, not months. */
  checkoutRestore: 30 * 24 * 60 * 60 * 1000,
  /**
   * Set-a-password link in a welcome or staff invitation email (replaces the
   * temporary password those emails used to carry). Forgot-password still works after.
   */
  welcomePassword: 7 * 24 * 60 * 60 * 1000,
} as const;

export type IssuedCapabilityToken = {
  /** Put this in the URL / email. Never log it. */
  raw: string;
  /** SHA-256 hex — store in the public *Token column. */
  hash: string;
  /** AES-GCM of raw — store in *TokenEnc so reminders / admin copy can re-send. */
  enc: string;
};

export function generateCapabilityToken(): IssuedCapabilityToken {
  const raw = randomBytes(CAPABILITY_TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashCapabilityToken(raw), enc: encrypt(raw) };
}

export function hashCapabilityToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Prisma cuid() strings are ~25 chars starting with `c`. New tokens are longer base64url.
 * Only used to refuse cuid-shaped input early; nothing stores a cuid token any more.
 */
export function isLegacyCuidToken(raw: string): boolean {
  const t = raw.trim();
  return /^c[a-z0-9]{20,32}$/i.test(t);
}

export function capabilityHashesEqual(storedHash: string, candidateHash: string): boolean {
  const a = Buffer.from(storedHash, "utf8");
  const b = Buffer.from(candidateHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Resolve a raw URL token to the DB lookup key: always its SHA-256.
 * Pre-AZ3 cuid links still work because the upgrade stored their hash too;
 * no column compares a URL value to plaintext any more.
 */
export function capabilityLookupKey(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return hashCapabilityToken(t);
}

export function assertCapabilityNotExpired(
  expiresAt: Date | null | undefined,
  now = new Date(),
): "ok" | "expired" {
  if (!expiresAt) return "ok";
  return expiresAt.getTime() < now.getTime() ? "expired" : "ok";
}

/** Reveal the raw URL token for email / admin copy. Null means issue a fresh one. */
export function revealCapabilityToken(row: {
  token: string;
  enc: string | null | undefined;
}): string | null {
  if (!row.enc?.trim()) return null;
  try {
    return decrypt(row.enc);
  } catch {
    return null;
  }
}

export function invoiceCapabilityExpiresAt(input: {
  documentExpiresAt: Date | null | undefined;
  paidAt: Date | null | undefined;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  const margin = CAPABILITY_TTL_MS.invoiceAfterDocument;
  if (input.paidAt) return new Date(input.paidAt.getTime() + margin);
  if (input.documentExpiresAt) return new Date(input.documentExpiresAt.getTime() + margin);
  return new Date(now.getTime() + margin);
}

export const CAPABILITY_EXPIRED_COPY = {
  title: "This link has expired",
  body: "Ask the house for a fresh link — reply to the email that brought you here, or write to the atelier.",
} as const;

/** Token routes 404 for expired and unknown links alike (real status, one message). */
export const CAPABILITY_GONE_COPY = {
  title: "This link has expired or is no longer valid",
  body: "Ask the house for a fresh link — reply to the email that brought you here, or write to the atelier.",
} as const;
