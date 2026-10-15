/**
 * Email verification gates every "her email matches the record" check.
 *
 *   pnpm test:email-verification          (unit checks)
 *   ALLOW_FIXTURES=true pnpm test:email-verification   (plus database checks, on a local test DB)
 */
import "./preload-test-env";
import { safeCallbackPath } from "../src/lib/login-paths";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
  console.log(`  ok   ${message}`);
}

function unit() {
  console.log("unit");
  assert(safeCallbackPath("/account/consultations?x=1") === "/account/consultations?x=1", "on-site path kept");
  assert(safeCallbackPath("javascript:alert(1)") === "/account", "javascript: refused");
  assert(safeCallbackPath("//evil.example") === "/account", "protocol-relative refused");
  assert(safeCallbackPath("/\\evil.example") === "/account", "backslash host refused");
  assert(safeCallbackPath("https://evil.example/x") === "/account", "absolute URL refused");
}

async function database() {
  const { assertFixturesAllowed } = await import("./fixture-guard");
  assertFixturesAllowed("test-email-verification");
  const { prisma } = await import("../src/lib/prisma");
  const ev = await import("../src/lib/email-verification");
  const { reviewableConsultationWhere } = await import("../src/lib/consultation-review");

  console.log("database");
  const stamp = Date.now();
  const email = `verify-test-${stamp}@example.test`;
  const user = await prisma.user.create({ data: { email, name: "Verify Test" } });
  try {
    assert((await ev.provenEmail(user.id)) === null, "a new account has no proven email");
    const where = await reviewableConsultationWhere(user.id, "c-1");
    assert(JSON.stringify(where).includes(email) === false, "unverified: consultations match by userId only");

    const raw = await ev.issueVerifyEmailToken(user.id, email);
    const older = raw;
    const fresh = await ev.issueVerifyEmailToken(user.id, email);
    assert((await ev.consumeVerifyEmailToken(older)) === "invalid", "a resend retires the older link");
    assert((await ev.consumeVerifyEmailToken("not-a-token")) === "invalid", "a malformed link is refused");
    assert((await ev.consumeVerifyEmailToken(fresh)) === "verified", "the current link verifies");
    assert((await ev.consumeVerifyEmailToken(fresh)) === "invalid", "a link works once");
    assert((await ev.provenEmail(user.id)) === email, "verified: the email is proven");
    const whereAfter = await reviewableConsultationWhere(user.id, "c-1");
    assert(JSON.stringify(whereAfter).includes(email), "verified: consultations also match by email");

    // A link sent before an email change verifies nothing.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: null } });
    const stale = await ev.issueVerifyEmailToken(user.id, email);
    await prisma.user.update({ where: { id: user.id }, data: { email: `changed-${email}` } });
    assert((await ev.consumeVerifyEmailToken(stale)) === "invalid", "a link for an old address is refused");
    assert((await ev.provenEmail(user.id)) === null, "the new address stays unproven");

    // Expired links.
    const expired = await ev.issueVerifyEmailToken(user.id, `changed-${email}`);
    await prisma.verificationToken.updateMany({
      where: { identifier: { startsWith: `verify-email:${user.id}:` } },
      data: { expires: new Date(Date.now() - 1000) },
    });
    assert((await ev.consumeVerifyEmailToken(expired)) === "expired", "an expired link is refused");
  } finally {
    await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: `verify-email:${user.id}:` } } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

async function run() {
  unit();
  if (process.env.TEST_DB_GUARD) {
    console.log(`skip database: ${process.env.TEST_DB_GUARD}`);
  } else {
    await database();
  }
  console.log("OK — test-email-verification");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
