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

/**
 * Key rotation. Encryption always uses ENCRYPTION_KEY. Decryption also tries
 * the keys in ENCRYPTION_KEY_PREVIOUS (comma-separated), so rotating is:
 *   1. set the new ENCRYPTION_KEY and move the old one to ENCRYPTION_KEY_PREVIOUS;
 *   2. deploy: the entrypoint runs scripts/reencrypt-secrets.ts, which rewrites
 *      every column on src/lib/encrypted-columns.ts under the new key;
 *   3. once it reports nothing left under an old key, remove ENCRYPTION_KEY_PREVIOUS.
 * Removing an old key before step 2 finishes makes what it encrypted unreadable.
 */
function previousSecrets(): string[] {
  if (typeof window !== "undefined") return [];
  return (process.env.ENCRYPTION_KEY_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== ENCRYPTION_SECRET);
}

function keyFor(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function deriveKey(): Buffer {
  return keyFor(ENCRYPTION_SECRET);
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

export function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && (value.startsWith(PREFIX_GCM) || value.startsWith(PREFIX_LEGACY_CBC)));
}

function decryptGcm(encrypted: string, key: Buffer): string {
  const buf = Buffer.from(encrypted.slice(PREFIX_GCM.length), "base64");
  if (buf.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function decryptCbc(encrypted: string, key: Buffer): string {
  const buf = Buffer.from(encrypted.slice(PREFIX_LEGACY_CBC.length), "base64");
  if (buf.length <= 16) throw new Error("Invalid encrypted payload");
  const iv = buf.subarray(0, 16);
  const data = buf.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Decrypt with the current key, then any previous key. Returns which key worked. */
function decryptWithKeyring(encrypted: string): { plain: string; current: boolean } {
  const secrets = [ENCRYPTION_SECRET, ...previousSecrets()];
  const run = encrypted.startsWith(PREFIX_GCM) ? decryptGcm : decryptCbc;
  let lastError: unknown = null;
  for (let i = 0; i < secrets.length; i++) {
    try {
      // GCM authenticates, so a wrong key throws rather than returning noise.
      return { plain: run(encrypted, keyFor(secrets[i])), current: i === 0 };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not decrypt");
}

/** Decrypt GCM payloads; transparently reads legacy CBC (`v1:`) ciphertext and previous keys. */
export function decrypt(encrypted: string): string {
  if (!isEncrypted(encrypted)) return encrypted;
  return decryptWithKeyring(encrypted).plain;
}

/**
 * For key rotation: the value under the current key, or null when it already is
 * (current-key GCM). Legacy CBC is always rewritten as GCM.
 */
export function reencryptIfNeeded(encrypted: string): string | null {
  if (!isEncrypted(encrypted)) return null;
  const { plain, current } = decryptWithKeyring(encrypted);
  if (current && encrypted.startsWith(PREFIX_GCM)) return null;
  return encrypt(plain);
}
