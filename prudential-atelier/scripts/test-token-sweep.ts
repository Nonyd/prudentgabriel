/**
 * The token sweep, by behaviour: restore links, unsubscribe links, the
 * set-your-password link that replaced emailed temporary passwords, the
 * one-time upgrade of plaintext rows, and /track needing the email too.
 * (Staff invitations: scripts/test-signin-errors.ts. The schema rule:
 * scripts/test-token-defaults.ts.)
 *
 *   pnpm test:token-sweep                                   # database checks
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3100 pnpm test:token-sweep   # + live status codes
 */
import "./preload-test-env";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { BespokeStage, EmailStatus, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { generateCapabilityToken, hashCapabilityToken } from "../src/lib/capability-token";
import { decrypt } from "../src/lib/encryption";
import {
  ensureRestoreRaw,
  ensureUnsubscribeRaw,
  findCheckoutSessionByRestoreToken,
  findEmailPreferenceByUnsubscribeToken,
} from "../src/lib/capability-token-lookup";
import { ensureEmailPreference } from "../src/lib/email-consent";
import { queueEmail, setSkipImmediateDeliverForTest } from "../src/lib/email-outbox";
import { autoOnboardClient } from "../src/lib/client-onboarding";
import { generateBespokeOrderRef } from "../src/lib/bespoke-stages";
import { assertFixturesAllowed, looksLikeProductionDatabase, looksLikeStagingDatabase } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = Date.now();
const base = process.env.BASE_URL?.replace(/\/$/, "");

/** A token says nothing about the next one: no counter, clock or shared structure. */
async function unpredictable() {
  const issued = Array.from({ length: 2000 }, () => generateCapabilityToken().raw);
  assert(new Set(issued).size === issued.length, "2,000 tokens, no repeats");
  assert(issued.every((t) => /^[A-Za-z0-9_-]{43}$/.test(t)), "each is 256 bits, base64url");
  let longestShared = 0;
  for (let i = 1; i < issued.length; i++) {
    let n = 0;
    while (n < 43 && issued[i][n] === issued[i - 1][n]) n++;
    longestShared = Math.max(longestShared, n);
  }
  // Random base64url: two neighbours share 4+ leading characters about once in 16 million pairs.
  assert(longestShared < 4, `consecutive tokens share no prefix (longest ${longestShared})`);
  const counts = new Map<string, number>();
  for (const c of issued.join("")) counts.set(c, (counts.get(c) ?? 0) + 1);
  const expected = (issued.length * 43) / 64;
  assert(counts.size === 64 && Array.from(counts.values()).every((v) => Math.abs(v - expected) < expected * 0.2), "characters are evenly spread");

  // Two links issued back to back, for rows created back to back.
  const [a, b] = await Promise.all(
    [1, 2].map((n) =>
      prisma.checkoutSession.create({ data: { email: `sweep-pair-${n}-${stamp}@example.test`, cartSnapshot: { lines: [], subtotalNGN: 0 } } }),
    ),
  );
  try {
    const [ra, rb] = [await ensureRestoreRaw(a), await ensureRestoreRaw(b)];
    assert(ra !== rb && !(await findCheckoutSessionByRestoreToken(ra.slice(0, -1) + (ra.endsWith("A") ? "B" : "A"))), "a neighbour of one link opens nothing");
    assert((await findCheckoutSessionByRestoreToken(rb))?.id === b.id && (await findCheckoutSessionByRestoreToken(ra))?.id === a.id, "each link opens only its own bag");
  } finally {
    await prisma.checkoutSession.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }
  console.log("ok unpredictable: no repeats, no shared structure, a near-miss opens nothing");
}

async function restoreLinks() {
  const session = await prisma.checkoutSession.create({
    data: { email: `sweep-restore-${stamp}@example.test`, cartSnapshot: { lines: [], subtotalNGN: 0 } },
  });
  try {
    assert(/^[0-9a-f]{64}$/.test(session.restoreToken), "a new bag's restore column is a random hash");
    assert(!(await findCheckoutSessionByRestoreToken(session.restoreToken)), "the stored value opens nothing");
    const raw = await ensureRestoreRaw(session);
    const row = await prisma.checkoutSession.findUniqueOrThrow({ where: { id: session.id } });
    assert(row.restoreToken === hashCapabilityToken(raw) && row.restoreTokenEnc, "the row keeps the hash and an encrypted copy");
    assert(row.restoreTokenExpiresAt && row.restoreTokenExpiresAt.getTime() > Date.now() + 29 * 86_400_000, "and expires in thirty days");
    assert((await ensureRestoreRaw(row)) === raw, "every reminder carries the same link");
    assert(await findCheckoutSessionByRestoreToken(raw), "the link opens the bag");

    if (base) {
      const get = (t: string) => fetch(`${base}/api/checkout/restore/${encodeURIComponent(t)}`, { headers: { "x-forwarded-for": "203.0.113.91" } });
      assert((await get(raw)).status === 200, "live: the link is a 200");
      assert((await get(row.restoreToken)).status === 404, "live: the stored hash is a 404");
    }

    await prisma.checkoutSession.update({ where: { id: session.id }, data: { restoreTokenExpiresAt: new Date(Date.now() - 1000) } });
    assert(!(await findCheckoutSessionByRestoreToken(raw)), "expired: opens nothing");
    await prisma.checkoutSession.update({ where: { id: session.id }, data: { restoreTokenExpiresAt: null, recoveredAt: new Date() } });
    assert(!(await findCheckoutSessionByRestoreToken(raw)), "a bag already bought: opens nothing");
  } finally {
    await prisma.checkoutSession.delete({ where: { id: session.id } });
  }
  console.log("ok restore links: hashed, encrypted for re-send, thirty days, unknown / expired / used open nothing");
}

async function unsubscribeLinks() {
  const email = `sweep-unsub-${stamp}@example.test`;
  const pref = await ensureEmailPreference(email);
  try {
    assert(!(await findEmailPreferenceByUnsubscribeToken(pref.unsubscribeToken)), "the stored default opens nothing");
    const raw = await ensureUnsubscribeRaw(pref);
    const row = await prisma.emailPreference.findUniqueOrThrow({ where: { id: pref.id } });
    assert(row.unsubscribeToken === hashCapabilityToken(raw) && row.unsubscribeTokenEnc, "hash plus encrypted copy");
    assert((await ensureUnsubscribeRaw(row)) === raw, "the same link in every email");
    assert((await findEmailPreferenceByUnsubscribeToken(raw))?.id === pref.id, "the link finds the address");

    setSkipImmediateDeliverForTest(true);
    const { id } = await queueEmail({
      to: email,
      subject: "Sweep",
      html: "<p>hello</p>",
      template: "collection-campaign",
      idempotencyKey: `sweep-unsub-${stamp}`,
    });
    const mail = await prisma.emailMessage.findUniqueOrThrow({ where: { id } });
    assert(mail.html.includes(`/unsubscribe/${encodeURIComponent(raw)}`), "a marketing email carries the raw link");
    assert(!mail.html.includes(row.unsubscribeToken), "and never the stored hash");
    await prisma.emailMessage.delete({ where: { id } });

    if (base) {
      const page = (t: string) => fetch(`${base}/unsubscribe/${encodeURIComponent(t)}`, { headers: { "x-forwarded-for": "203.0.113.92" } });
      assert((await page(raw)).status === 200, "live: the unsubscribe page opens from the link");
      assert((await page(row.unsubscribeToken)).status === 404, "live: the stored hash is a 404");
    }
  } finally {
    setSkipImmediateDeliverForTest(false);
    await prisma.emailPreference.delete({ where: { id: pref.id } });
  }
  console.log("ok unsubscribe links: hashed, one link per address, emails carry the raw link only, unknown is a 404");
}

/** Accounts the house opens get a set-your-password link, never a password. */
async function welcomeLink() {
  const email = `sweep-welcome-${stamp}@example.test`;
  const holder = await prisma.user.create({ data: { email: `sweep-holder-${stamp}@example.test`, name: "Holder", role: Role.CUSTOMER, password: "x" } });
  const profile = await prisma.clientProfile.create({ data: { userId: holder.id } });
  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "Sweep Welcome",
      clientEmail: email,
      currentStage: BespokeStage.CONSULTATION_SESSION,
      status: OrderStatus.PROCESSING,
      totalAmount: 1,
      balance: 1,
    },
  });
  setSkipImmediateDeliverForTest(true);
  let userId: string | null = null;
  try {
    const result = await autoOnboardClient({ name: "Sweep Welcome", email, source: "BESPOKE_ORDER", sourceId: order.id });
    userId = result.userId;
    assert(!("tempPassword" in result), "no temporary password is returned");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert(!user.mustResetPassword, "the account is not parked on a temporary password");
    for (const guess of ["AMBER-1000", "SILK-4242", ""]) {
      assert(!(await bcrypt.compare(guess, user.password ?? "")), `the starting password is not guessable (${guess || "empty"})`);
    }
    const tokens = await prisma.passwordResetToken.findMany({ where: { userId } });
    assert(tokens.length === 1, "one set-your-password token");
    const ttl = tokens[0].expiresAt.getTime() - Date.now();
    assert(ttl > 6.9 * 86_400_000 && ttl < 7.1 * 86_400_000, "that lasts seven days");

    let mail = null;
    for (let i = 0; i < 50 && !mail; i++) {
      mail = await prisma.emailMessage.findFirst({ where: { to: email, template: "welcome-credentials" } });
      if (!mail) await new Promise((r) => setTimeout(r, 100));
    }
    assert(mail, "the welcome email is queued");
    const raw = /\/auth\/reset-password\/([0-9a-f]{64})/.exec(mail.html)?.[1];
    assert(raw && hashCapabilityToken(raw) === tokens[0].token, "it carries the set-your-password link, stored hashed");
    assert(!/temporary password/i.test(mail.html), "and no password");
  } finally {
    setSkipImmediateDeliverForTest(false);
    await prisma.emailMessage.deleteMany({ where: { to: email } });
    await prisma.bespokeOrder.delete({ where: { id: order.id } });
    if (userId) {
      await prisma.passwordResetToken.deleteMany({ where: { userId } });
      await prisma.pointsTransaction.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.clientProfile.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.clientProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: holder.id } });
  }
  console.log("ok welcome: a new account gets a seven-day set-your-password link, never a password");
}

/** The one-time upgrade: plaintext rows hashed (old links keep working), temporary passwords retired, stored copies redacted. */
async function upgrade() {
  const legacy = `c${stamp.toString(36)}legacyrestore0000`;
  const session = await prisma.checkoutSession.create({
    data: { email: `sweep-legacy-${stamp}@example.test`, cartSnapshot: { lines: [], subtotalNGN: 0 }, restoreToken: legacy },
  });
  const parked = await prisma.user.create({
    data: { email: `sweep-parked-${stamp}@example.test`, name: "Parked", role: Role.ADMIN, password: await bcrypt.hash("AMBER-1234", 4), mustResetPassword: true },
  });
  const mk = (status: EmailStatus, n: string) =>
    prisma.emailMessage.create({
      data: {
        idempotencyKey: `sweep-${n}-${stamp}`,
        to: parked.email,
        fromAddress: "atelier@example.test",
        subject: "Invite",
        template: "user-invite",
        html: "<p>Temporary password: <strong>AMBER-1234</strong></p>",
        status,
      },
    });
  const sent = await mk(EmailStatus.SENT, "sent");
  const queued = await mk(EmailStatus.QUEUED, "queued");
  try {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/upgrade-capability-tokens.ts"], {
      stdio: "pipe",
      env: { ...process.env, TSX_TSCONFIG_PATH: "tsconfig.scripts.json" },
    });
    const row = await prisma.checkoutSession.findUniqueOrThrow({ where: { id: session.id } });
    assert(row.restoreToken === hashCapabilityToken(legacy), "a plaintext link token is stored as its hash");
    assert(row.restoreTokenEnc && decrypt(row.restoreTokenEnc) === legacy, "with an encrypted copy, so reminders can send it again");
    assert((await findCheckoutSessionByRestoreToken(legacy))?.id === session.id, "the link already in her inbox still opens");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: parked.id } });
    assert(!user.mustResetPassword && !(await bcrypt.compare("AMBER-1234", user.password ?? "")), "the temporary password no longer signs in");
    assert(user.passwordChangedAt, "and any session opened with it is ended");

    const s = await prisma.emailMessage.findUniqueOrThrow({ where: { id: sent.id } });
    const q = await prisma.emailMessage.findUniqueOrThrow({ where: { id: queued.id } });
    assert(!s.html.includes("AMBER-1234"), "a sent copy of the password email is redacted");
    assert(q.html.includes("AMBER-1234"), "a queued one still goes out whole");
  } finally {
    await prisma.emailMessage.deleteMany({ where: { id: { in: [sent.id, queued.id] } } });
    await prisma.user.delete({ where: { id: parked.id } });
    await prisma.checkoutSession.delete({ where: { id: session.id } });
  }
  console.log("ok upgrade: plaintext tokens hashed and still open, temporary passwords retired, stored copies redacted");
}

/** A four-digit reference no longer opens a commission on its own. */
async function trackLookup() {
  if (!base) {
    console.log("skip live /track lookup: set BASE_URL");
    return;
  }
  const email = `sweep-track-${stamp}@example.test`;
  const holder = await prisma.user.create({ data: { email, name: "Track", role: Role.CUSTOMER, password: "x" } });
  const profile = await prisma.clientProfile.create({ data: { userId: holder.id } });
  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "Track Sweep",
      clientEmail: email,
      currentStage: BespokeStage.CONSULTATION_SESSION,
      status: OrderStatus.PROCESSING,
      totalAmount: 1,
      balance: 1,
    },
  });
  const ip = "203.0.113.93";
  try {
    const bare = await fetch(`${base}/track?ref=${encodeURIComponent(order.orderRef)}`, { redirect: "manual", headers: { "x-forwarded-for": ip } });
    assert(bare.status === 200, `/track?ref= alone fills the form and redirects nowhere (${bare.status})`);
    const lookup = (body: object) =>
      fetch(`${base}/api/track/lookup`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
    assert((await lookup({ ref: order.orderRef })).status === 400, "the reference alone is a 400");
    assert((await lookup({ ref: order.orderRef, email: "someone-else@example.test" })).status === 404, "with the wrong email, a 404");
    const ok = await lookup({ ref: order.orderRef.toLowerCase(), email: email.toUpperCase() });
    assert(ok.status === 200, "reference and email (any case) find it");
    const { url } = (await ok.json()) as { url: string };
    assert((await fetch(`${base}${url}`, { headers: { "x-forwarded-for": ip } })).status === 200, "and hand back a working tracking link");
  } finally {
    await prisma.bespokeOrder.delete({ where: { id: order.id } });
    await prisma.clientProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: holder.id } });
  }
  console.log("ok live /track: reference alone opens nothing; reference + email hands back the link");
}

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log("skip: database unreachable");
    return;
  }
  assert(!looksLikeProductionDatabase() && !looksLikeStagingDatabase(), "never against production or staging");
  if (base) assertFixturesAllowed("test-token-sweep");
  await unpredictable();
  await restoreLinks();
  await unsubscribeLinks();
  await welcomeLink();
  await upgrade();
  await trackLookup();
  console.log("OK test-token-sweep");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
