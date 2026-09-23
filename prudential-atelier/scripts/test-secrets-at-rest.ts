/**
 * Secrets at rest: a saved card's Paystack authorisation code is only ever
 * stored encrypted, the payment ledger keeps no authority to charge, and the
 * encryption key can be rotated without losing anything it encrypted.
 *
 *   pnpm test:secrets-at-rest          # keyring checks always; DB checks when reachable
 */
import "./preload-test-env";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PaymentMethod, PaymentPurpose, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { withoutChargeAuthority, appendPayment } from "../src/lib/payments/ledger";
import { ENCRYPTED_COLUMNS } from "../src/lib/encrypted-columns";
import { looksLikeProductionDatabase, looksLikeStagingDatabase } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const KEY_A = "test-rotation-key-a-not-a-real-key";
const KEY_B = "test-rotation-key-b-not-a-real-key";
const KEY_C = "test-rotation-key-c-never-configured";

/** Run encryption.ts in a fresh process under a given keyring (the key is fixed at module load). */
function underKeys(env: { current: string; previous?: string }, code: string): { ok: boolean; out: string; why: string } {
  const r = spawnSync(process.execPath, ["--import", "tsx", "-e", code], {
    env: { ...process.env, ENCRYPTION_KEY: env.current, SETTINGS_ENCRYPTION_KEY: "", ENCRYPTION_KEY_PREVIOUS: env.previous ?? "" },
    encoding: "utf8",
  });
  const out = (r.stdout ?? "").trim();
  // What the child said on stderr: without it a CI failure here says nothing.
  const why = (r.stderr ?? "").trim().split(/\r?\n/).slice(-4).join(" | ");
  return { ok: r.status === 0, out, why };
}
// A file URL that is right on Windows and on the Linux CI runner alike.
const enc = pathToFileURL(path.resolve("src/lib/encryption.ts")).href;
const encryptRun = (key: string, plain: string) =>
  underKeys({ current: key }, `import("${enc}").then(ns => (ns.encrypt ? ns : ns.default)).then(m => console.log(m.encrypt(${JSON.stringify(plain)})))`);
const encryptWith = (key: string, plain: string) => encryptRun(key, plain).out;

function keyring() {
  const first = encryptRun(KEY_A, "AUTH_secret123");
  const a = first.out;
  assert(a.startsWith("gcm:"), `encrypts as GCM (child: ${first.why || "no stderr"})`);
  const read = (keys: { current: string; previous?: string }, value: string) =>
    underKeys(keys, `import("${enc}").then(ns => (ns.encrypt ? ns : ns.default)).then(m => console.log(m.decrypt(${JSON.stringify(value)})))`);
  assert(read({ current: KEY_A }, a).out === "AUTH_secret123", "the key that wrote it reads it");
  assert(!read({ current: KEY_B }, a).ok, "a different key cannot read it (GCM refuses, it does not return noise)");
  assert(read({ current: KEY_B, previous: KEY_A }, a).out === "AUTH_secret123", "after rotation, the previous key still reads old values");

  const again = underKeys(
    { current: KEY_B, previous: KEY_A },
    `import("${enc}").then(ns => (ns.encrypt ? ns : ns.default)).then(m => console.log(m.reencryptIfNeeded(${JSON.stringify(a)})))`,
  ).out;
  assert(again.startsWith("gcm:") && again !== a, "re-encryption writes it under the new key");
  assert(read({ current: KEY_B }, again).out === "AUTH_secret123", "which the new key alone can read");
  const settled = underKeys({ current: KEY_B }, `import("${enc}").then(ns => (ns.encrypt ? ns : ns.default)).then(m => console.log(String(m.reencryptIfNeeded(${JSON.stringify(again)}))))`).out;
  assert(settled === "null", "and a value already under the current key is left alone");
  console.log("ok keyring: rotate with ENCRYPTION_KEY_PREVIOUS, re-encrypt, then retire the old key");
}

function registry() {
  const schema = readFileSync(path.resolve("prisma/schema.prisma"), "utf8").replace(/\r\n/g, "\n");
  const listed = new Set(ENCRYPTED_COLUMNS.map((c) => `${c.model}.${c.column}`));
  for (const m of Array.from(schema.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm))) {
    for (const line of m[2].split("\n")) {
      const f = /^\s*(\w+Enc)\s+String/.exec(line);
      if (f) assert(listed.has(`${m[1]}.${f[1]}`), `${m[1]}.${f[1]} is on encrypted-columns.ts, so key rotation rewrites it`);
    }
  }
  const card = /model SavedPaymentMethod \{[\s\S]*?\n\}/.exec(schema)![0];
  assert(!/@@unique\([^)]*paystackAuthCode\b/.test(card), "no index keeps the plaintext code");
  console.log(`ok registry: every *Enc column is on the rotation list (${ENCRYPTED_COLUMNS.length} columns)`);
}

function ledgerStrip() {
  const payload = { status: "success", authorization: { authorization_code: "AUTH_abc123", signature: "SIG_xyz", last4: "4081" }, authorization_code: "AUTH_abc123" };
  const out = withoutChargeAuthority(payload) as Record<string, any>;
  assert(!JSON.stringify(out).includes("AUTH_abc123"), "a payload loses the authorisation code");
  assert(out.authorization.signature === "SIG_xyz" && out.authorization.last4 === "4081" && out.status === "success", "and keeps everything else, the card signature included");
  console.log("ok ledger: gateway payloads keep evidence, not the authority to charge");
}

async function database() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log("skip database: unreachable");
    return;
  }
  assert(!looksLikeProductionDatabase() && !looksLikeStagingDatabase(), "never against production or staging");
  const stamp = Date.now();
  const user = await prisma.user.create({ data: { email: `secrets-${stamp}@example.test`, name: "Secrets", role: Role.CUSTOMER, password: "x" } });
  const reference = `secrets-${stamp}`;
  const devKey = (process.env.ENCRYPTION_KEY ?? process.env.SETTINGS_ENCRYPTION_KEY ?? "").trim();
  try {
    // Written at insert: the ledger strips the code itself.
    const pay = await appendPayment({
      reference,
      amount: 1000,
      method: PaymentMethod.PAYSTACK,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.RTW_ORDER,
      clientId: user.id,
      gatewayPayload: { authorization: { authorization_code: "AUTH_insert", signature: "SIG_1" } },
    });
    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    assert(!JSON.stringify(stored.gatewayPayload).includes("AUTH_insert"), "appendPayment never stores a card authorisation code");

    // An old row (written before this change) and an old card, then the upgrade.
    await prisma.payment.update({ where: { id: pay.id }, data: { gatewayPayload: { authorization: { authorization_code: "AUTH_old", signature: "SIG_1" } } } });
    const card = await prisma.savedPaymentMethod.create({
      data: { userId: user.id, gateway: "PAYSTACK", paystackAuthCode: "AUTH_card_old", paystackCardLast4: "4081" },
    });
    execFileSync(process.execPath, ["--import", "tsx", "scripts/upgrade-capability-tokens.ts"], {
      stdio: "pipe",
      env: { ...process.env, TSX_TSCONFIG_PATH: "tsconfig.scripts.json" },
    });
    const { decrypt } = await import("../src/lib/encryption");
    const upgraded = await prisma.savedPaymentMethod.findUniqueOrThrow({ where: { id: card.id } });
    assert(upgraded.paystackAuthCode === null, "the upgrade empties the plaintext column");
    assert(upgraded.paystackAuthCodeEnc && decrypt(upgraded.paystackAuthCodeEnc) === "AUTH_card_old", "and keeps the code, encrypted");
    const old = await prisma.payment.findUniqueOrThrow({ where: { id: pay.id } });
    assert(!JSON.stringify(old.gatewayPayload).includes("AUTH_old") && JSON.stringify(old.gatewayPayload).includes("SIG_1"), "old payment payloads lose the code, keep the signature");
    const plain = await prisma.savedPaymentMethod.count({ where: { paystackAuthCode: { not: null } } });
    assert(plain === 0, `no saved card holds a plaintext code (${plain})`);
    const inLedger = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) n FROM "Payment" WHERE "gatewayPayload"::text ~ '"authorization_?[cC]ode"'`);
    assert(inLedger[0].n === BigInt(0), "no payment payload holds one");

    // Rotation over the real database: this card was encrypted under a key now
    // "previous"; the current (dev) key takes it over; everything else is untouched.
    const underA = encryptWith(KEY_A, "AUTH_rotating");
    await prisma.savedPaymentMethod.update({ where: { id: card.id }, data: { paystackAuthCodeEnc: underA } });
    const rotate = (previous: string, check = false) =>
      spawnSync(process.execPath, ["--import", "tsx", "scripts/reencrypt-secrets.ts", ...(check ? ["--check"] : [])], {
        env: { ...process.env, TSX_TSCONFIG_PATH: "tsconfig.scripts.json", ENCRYPTION_KEY: devKey, ENCRYPTION_KEY_PREVIOUS: previous },
        encoding: "utf8",
      });
    const dry = rotate(KEY_A, true);
    assert(dry.status === 0 && /would rewrite 1;/.test(dry.stdout), `a dry run finds exactly the one value under the old key (${dry.stdout.trim()})`);
    const run = rotate(KEY_A);
    assert(run.status === 0 && /rewrote 1;/.test(run.stdout) && /unreadable 0/.test(run.stdout), `rotation rewrites it (${run.stdout.trim()})`);
    const rotated = await prisma.savedPaymentMethod.findUniqueOrThrow({ where: { id: card.id } });
    assert(rotated.paystackAuthCodeEnc !== underA && decrypt(rotated.paystackAuthCodeEnc!) === "AUTH_rotating", "the current key alone now reads it");
    assert(/rewrote 0;/.test(rotate(KEY_A).stdout), "running it again changes nothing");

    // A value no configured key can read: the run says so and fails, so nobody retires a key too soon.
    await prisma.savedPaymentMethod.update({ where: { id: card.id }, data: { paystackAuthCodeEnc: encryptWith(KEY_C, "AUTH_lost") } });
    const lost = rotate(KEY_A);
    assert(lost.status === 1 && /unreadable 1/.test(lost.stdout), "an unreadable value fails the run and is named");
    console.log("ok database: codes encrypted at insert and by the upgrade; rotation rewrites exactly what needs it and refuses to hide a loss");
  } finally {
    await prisma.savedPaymentMethod.deleteMany({ where: { userId: user.id } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.ledger_bypass', 'on', true)`);
      await tx.payment.deleteMany({ where: { reference } });
    });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function main() {
  keyring();
  registry();
  ledgerStrip();
  await database();
  console.log("OK test-secrets-at-rest");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
