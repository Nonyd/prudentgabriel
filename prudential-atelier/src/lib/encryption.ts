import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX_GCM = "gcm:";
const PREFIX_LEGACY_CBC = "v1:";

function isNextCompileTime(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_DB_BUILD === "1"
  );
}

function requireEncryptionSecret(): string {
  const raw = (process.env.ENCRYPTION_KEY ?? process.env.SETTINGS_ENCRYPTION_KEY ?? "").trim();
  if (!raw) {
    if (isNextCompileTime()) {
      // `next build` imports API routes; the real key is injected at container start.
      return "build-time-placeholder-not-a-runtime-key";
    }
    throw new Error(
      "ENCRYPTION_KEY or SETTINGS_ENCRYPTION_KEY must be set. Refusing to start without an encryption key.",
    );
  }
  return raw;
}

/** Resolved at module load on the server so a missing key fails closed on boot, not on first encrypt. */
const ENCRYPTION_SECRET =
  typeof window === "undefined" ? requireEncryptionSecret() : "";

function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_SECRET, "utf8").digest();
}

/** AES-256-GCM encrypt; output prefixed with `gcm:` for version detection. */
export function encrypt(text: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX_GCM + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt GCM payloads; transparently reads legacy CBC (`v1:`) ciphertext. */
export function decrypt(encrypted: string): string {
  if (encrypted.startsWith(PREFIX_GCM)) {
    const buf = Buffer.from(encrypted.slice(PREFIX_GCM.length), "base64");
    if (buf.length <= IV_LENGTH + TAG_LENGTH) {
      throw new Error("Invalid encrypted payload");
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  }

  if (encrypted.startsWith(PREFIX_LEGACY_CBC)) {
    const buf = Buffer.from(encrypted.slice(PREFIX_LEGACY_CBC.length), "base64");
    if (buf.length <= 16) throw new Error("Invalid encrypted payload");
    const iv = buf.subarray(0, 16);
    const data = buf.subarray(16);
    const key = deriveKey();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  }

  return encrypted;
}
