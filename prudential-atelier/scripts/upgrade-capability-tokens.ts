/**
 * Token sweep: hash every capability column still holding a plaintext value
 * (pre-AZ3 cuids, and the restore / unsubscribe columns before the sweep), keeping
 * an AES-GCM copy where the house re-sends the same link. The link in her inbox
 * keeps working: the lookup hashes what the link carries.
 *
 * Also retires the temporary passwords those emails carried (WORD-NNNN, about
 * 90,000 possibilities) on any account that never replaced one, and redacts the
 * stored copies of those emails.
 *
 * Idempotent. The container entrypoint runs it after `prisma migrate deploy`.
 *   tsx --tsconfig tsconfig.scripts.json scripts/upgrade-capability-tokens.ts
 */
import { createRequire } from "node:module";
import { EmailStatus } from "@prisma/client";
import path from "node:path";

// Laptop only: the image has no dotenv and already has DATABASE_URL / ENCRYPTION_KEY.
// Unlike preload-test-env, never fall back to a test encryption key.
try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv") as { config: (opts: { path: string }) => void };
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  /* runtime image */
}

const HEX64 = "^[0-9a-f]{64}$";

/** Templates whose body carried a temporary password before the sweep. */
const TEMP_PASSWORD_TEMPLATES = ["user-invite", "welcome-credentials"];
const REDACTED_HTML =
  "<p>This email contained a temporary password. Its stored copy was removed in the September 2026 token sweep; the recipient's own inbox is unchanged.</p>";

async function main() {
  if (!(process.env.ENCRYPTION_KEY ?? process.env.SETTINGS_ENCRYPTION_KEY ?? "").trim()) {
    throw new Error("ENCRYPTION_KEY is not set; refusing to encrypt link tokens with anything else.");
  }
  const { prisma } = await import("../src/lib/prisma");
  const { encrypt } = await import("../src/lib/encryption");
  const { hashCapabilityToken } = await import("../src/lib/capability-token");
  const { CAPABILITY_COLUMNS } = await import("../src/lib/capability-registry");
  const { unusablePasswordHash } = await import("../src/lib/temp-password");

  let total = 0;
  for (const c of CAPABILITY_COLUMNS) {
    // Identifiers come from the registry in this repo, never from input.
    const rows = await prisma.$queryRawUnsafe<{ id: string; token: string }[]>(
      `SELECT "id", "${c.column}" AS token FROM "${c.model}" WHERE "${c.column}" !~ '${HEX64}'`,
    );
    for (const row of rows) {
      const hash = hashCapabilityToken(row.token);
      if (c.enc) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${c.model}" SET "${c.column}" = $1, "${c.enc}" = COALESCE("${c.enc}", $2) WHERE "id" = $3 AND "${c.column}" = $4`,
          hash,
          encrypt(row.token),
          row.id,
          row.token,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "${c.model}" SET "${c.column}" = $1 WHERE "id" = $2 AND "${c.column}" = $3`,
          hash,
          row.id,
          row.token,
        );
      }
    }
    if (rows.length) console.log(`[capability-tokens] ${c.model}.${c.column}: hashed ${rows.length}`);
    total += rows.length;
  }

  // Pre-sweep restore links never expired; give them the same 30 days from when the bag was last touched.
  const restore = await prisma.$executeRawUnsafe(
    `UPDATE "CheckoutSession" SET "restoreTokenExpiresAt" = "lastActiveAt" + interval '30 days' WHERE "restoreTokenExpiresAt" IS NULL AND "restoreTokenEnc" IS NOT NULL`,
  );
  if (restore) console.log(`[capability-tokens] CheckoutSession: ${restore} restore links given an expiry`);

  // Saved cards: the Paystack authorisation code is a reusable authority to
  // charge. Encrypt it and empty the plaintext column.
  const cards = await prisma.savedPaymentMethod.findMany({
    where: { paystackAuthCode: { not: null } },
    select: { id: true, paystackAuthCode: true, paystackAuthCodeEnc: true },
  });
  for (const c of cards) {
    await prisma.savedPaymentMethod.update({
      where: { id: c.id },
      data: { paystackAuthCodeEnc: c.paystackAuthCodeEnc ?? encrypt(c.paystackAuthCode!), paystackAuthCode: null },
    });
  }
  if (cards.length) console.log(`[capability-tokens] encrypted ${cards.length} saved-card authorisation codes`);

  // Payment ledger: the gateway payload is evidence, not an authority to charge.
  // gatewayPayload is not one of the ledger's protected columns (amount,
  // currency, purpose, reference, links, createdAt), so no bypass is involved.
  const payloads = await prisma.$executeRawUnsafe(
    `UPDATE "Payment" SET "gatewayPayload" = ("gatewayPayload" #- '{authorization,authorization_code}' #- '{authorization,authorizationCode}') - 'authorization_code' - 'authorizationCode'
     WHERE "gatewayPayload"::text ~ '"authorization_?[cC]ode"'`,
  );
  if (payloads) console.log(`[capability-tokens] removed card authorisation codes from ${payloads} payment payloads`);

  // Only the two temporary-password flows ever set mustResetPassword, and the
  // middleware holds such an account at the reset screen, so a flagged account
  // has never chosen a password of its own. Forgot password opens it again.
  const temporary = await prisma.user.findMany({ where: { mustResetPassword: true }, select: { id: true } });
  for (const u of temporary) {
    await prisma.user.update({
      where: { id: u.id },
      data: { password: await unusablePasswordHash(), mustResetPassword: false, passwordChangedAt: new Date() },
    });
  }
  if (temporary.length) console.log(`[capability-tokens] retired ${temporary.length} temporary passwords`);

  const redacted = await prisma.emailMessage.updateMany({
    // Only mail that has left (or never will): a queued email must still go out whole.
    where: { template: { in: TEMP_PASSWORD_TEMPLATES }, status: { in: [EmailStatus.SENT, EmailStatus.DEAD] }, NOT: { html: REDACTED_HTML } },
    data: { html: REDACTED_HTML, text: null },
  });
  if (redacted.count) console.log(`[capability-tokens] redacted ${redacted.count} stored temporary-password emails`);

  console.log(`[capability-tokens] done (${total} plaintext tokens hashed)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[capability-tokens] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
