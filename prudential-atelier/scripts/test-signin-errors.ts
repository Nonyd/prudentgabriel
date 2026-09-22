/**
 * Sign-in failures say what actually happened.
 *
 *   pnpm test:signin-errors                                          # messages
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:signin-errors
 *
 * Live: signs in through the real Auth.js flow (CSRF + credentials callback)
 * as a fixture user, checks the refusal is logged with a masked email, and
 * that a rate-limited attempt carries error=RateLimited (not "invalid
 * credentials"). BA1: correct sign-ins from a shared address never count; one
 * account's lockout leaves a colleague on that address alone; spraying many
 * accounts is refused after 50 failures and logged once. Forgot-password is
 * limited per inbox, not per shared address; reset-password counts only wrong
 * links. Local server only — X-Forwarded-For picks a fresh bucket.
 */
import "./preload-test-env";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { RATE_LIMITED_ERROR, signInErrorMessage } from "../src/lib/signin-errors";
import { accountKey, maskAddress } from "../src/lib/auth-limits";
import { assertFixturesAllowed } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function unit() {
  assert(/Too many sign-in attempts/.test(signInErrorMessage({ error: RATE_LIMITED_ERROR, code: "600", status: 429 })), "rate limit says so");
  assert(/wait 10 minutes/.test(signInErrorMessage({ error: RATE_LIMITED_ERROR, code: "600" })), "rate limit gives the wait");
  assert(/Invalid email or password/.test(signInErrorMessage({ error: "CredentialsSignin", status: 200 })), "wrong password stays generic");
  assert(maskAddress("102.211.122.253") === "102.211.122.x", "a logged IPv4 address keeps only its /24");
  assert(maskAddress("2a06:98c1:3120::6") === "2a06:98c1:3120::/48", "a logged IPv6 address keeps only its /48");
  assert(accountKey(" Bride@Example.com ") === accountKey("bride@example.com") && !accountKey("a@b.c").includes("@"), "account keys are normalised hashes");
  console.log("ok messages");
}

/** One credentials sign-in the way next-auth's client does it. */
async function signInOnce(base: string, email: string, password: string, ip: string) {
  const csrfRes = await fetch(`${base}/api/auth/csrf`, { headers: { "x-forwarded-for": ip } });
  await csrfRes.arrayBuffer();
  // getSetCookie(): a Set-Cookie value can itself contain commas (Expires=…, dd Mon…).
  const setCookies = csrfRes.headers.getSetCookie();
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  // The token the server verifies is the one in the cookie ("<token>|<hash>").
  const raw = setCookies.find((c) => c.startsWith("authjs.csrf-token="))?.split(";")[0].split("=")[1] ?? "";
  const csrfToken = decodeURIComponent(raw).split("|")[0];
  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-auth-return-redirect": "1",
      "x-forwarded-for": ip,
      cookie,
    },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/account` }),
    redirect: "manual",
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string };
  const url = data.url ? new URL(data.url) : null;
  return { status: res.status, error: url?.searchParams.get("error") ?? null, code: url?.searchParams.get("code") ?? null };
}

async function forgot(base: string, email: string, ip: string): Promise<number> {
  const res = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email }),
  });
  await res.arrayBuffer();
  return res.status;
}

async function reset(base: string, body: Record<string, string>, ip: string): Promise<number> {
  const res = await fetch(`${base}/api/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  await res.arrayBuffer();
  return res.status;
}

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "local server only");
  assertFixturesAllowed("test-signin-errors");
  const email = `signin-${Date.now()}@example.test`;
  const password = "Correct-Horse-9";
  const user = await prisma.user.create({
    data: { email, name: "Signin Test", role: Role.CUSTOMER, password: await bcrypt.hash(password, 12) },
  });
  const colleague = await prisma.user.create({
    data: {
      email: `signin-colleague-${Date.now()}@example.test`,
      name: "Signin Colleague",
      role: Role.CUSTOMER,
      password: await bcrypt.hash(password, 12),
    },
  });
  const octet = Math.floor(Math.random() * 200) + 20;
  const ip = `198.51.100.${octet}`;
  const sprayIp = `203.0.113.${octet}`;
  const forgotIp = `192.0.2.${octet}`;
  const resetIp = `198.18.0.${octet}`;
  const inboxRange = `198.19.${octet}.`;
  const sprayMasked = maskAddress(sprayIp);
  const resetMasked = maskAddress(resetIp);
  const forgotEmails: string[] = [];
  try {
    const ok = await signInOnce(base, email, password, ip);
    assert(ok.status === 200 && !ok.error, `correct password signs in (${JSON.stringify(ok)})`);

    // BA1: people sharing one address (office Wi-Fi, carrier NAT) signing in
    // correctly must never lock each other out. The old limiter refused the 11th.
    for (let i = 0; i < 14; i++) {
      const who = i % 2 ? colleague.email! : email;
      const r = await signInOnce(base, who, password, ip);
      assert(r.status === 200 && !r.error, `correct sign-in #${i + 2} from a shared address is not limited (${JSON.stringify(r)})`);
    }

    const bad = await signInOnce(base, email, "Wrong-Password-1", ip);
    assert(bad.error === "CredentialsSignin", `wrong password is refused (${JSON.stringify(bad)})`);
    const logged = await prisma.errorLog.findFirst({
      where: { errorType: "AUTH_SIGNIN_WRONG_PASSWORD", userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    assert(logged, "the refusal is logged with its reason");
    assert(!logged.message.includes(email) && logged.message.includes("s***@example.test"), "email is masked in the log");
    assert(!logged.message.includes("Wrong-Password-1"), "password never logged");

    // Exhaust the 10-failures-per-15-minutes budget for this account at this address.
    let last = bad;
    let failures = 1;
    for (let i = 0; i < 12 && last.error !== RATE_LIMITED_ERROR; i++) {
      last = await signInOnce(base, email, "Wrong-Password-1", ip);
      if (last.error !== RATE_LIMITED_ERROR) failures++;
    }
    assert(failures === 10, `the account locks after exactly 10 failures (${failures})`);
    assert(last.status === 429 && last.error === RATE_LIMITED_ERROR && Number(last.code) > 0, `lockout carries RateLimited + wait (${JSON.stringify(last)})`);
    assert(/Too many sign-in attempts/.test(signInErrorMessage(last)), "the form tells the person to wait");
    const correctWhileLocked = await signInOnce(base, email, password, ip);
    assert(correctWhileLocked.error === RATE_LIMITED_ERROR, "even the right password is told to wait, not 'invalid'");
    const colleagueWhileLocked = await signInOnce(base, colleague.email!, password, ip);
    assert(
      colleagueWhileLocked.status === 200 && !colleagueWhileLocked.error,
      `a colleague on the same address still signs in (${JSON.stringify(colleagueWhileLocked)})`,
    );

    // Spraying many accounts from one address is still stopped, at 50 failures, and logged.
    let sprayed = 0;
    let spray = { status: 200, error: null as string | null, code: null as string | null };
    for (let i = 0; i < 52 && spray.error !== RATE_LIMITED_ERROR; i++) {
      spray = await signInOnce(base, `nobody-${i}-${Date.now()}@example.test`, "Wrong-Password-1", sprayIp);
      if (spray.error !== RATE_LIMITED_ERROR) sprayed++;
    }
    assert(sprayed === 50 && spray.status === 429, `an address is refused after 50 failures across accounts (${sprayed})`);
    await signInOnce(base, `nobody-again-${Date.now()}@example.test`, "Wrong-Password-1", sprayIp);
    const capLogs = await prisma.errorLog.count({
      where: { errorType: "AUTH_ADDRESS_CAP", message: { startsWith: `sign-in: ${sprayMasked} ` } },
    });
    assert(capLogs === 1, `the address cap is logged once per window, masked (${capLogs})`);
    const bucketKeys = await prisma.rateLimitBucket.findMany({ where: { key: { contains: ip } }, select: { key: true } });
    assert(bucketKeys.every((b) => !b.key.includes("@")), "the limiter never stores an email");
    console.log("ok live: shared address never locked by correct sign-ins; per-account and per-address lockouts say so");

    // Forgot-password: many people on one address each asking once is fine (it was 5).
    for (let i = 0; i < 8; i++) {
      forgotEmails.push(`forgot-${i}-${Date.now()}@example.test`);
      const r = await forgot(base, forgotEmails[i], forgotIp);
      assert(r === 200, `reset request #${i + 1} from a shared address is not limited (${r})`);
    }
    // One inbox is limited to 5 from anywhere.
    const inbox = `forgot-inbox-${Date.now()}@example.test`;
    forgotEmails.push(inbox);
    const inboxStatuses: number[] = [];
    for (let i = 0; i < 6; i++) inboxStatuses.push(await forgot(base, inbox, `${inboxRange}${i}`));
    assert(
      inboxStatuses.slice(0, 5).every((s) => s === 200) && inboxStatuses[5] === 429,
      `one inbox gets 5 reset emails per window, from any address (${inboxStatuses})`,
    );
    console.log("ok live: forgot-password limited per inbox, not per shared address");

    // Reset-password: a mistyped new password is not an attempt (it was 8 of anything).
    for (let i = 0; i < 12; i++) {
      const r = await reset(base, { token: "x".repeat(64), password: "Correct-Horse-9", confirmPassword: "Different-9" }, resetIp);
      assert(r === 400, `mismatched confirmation #${i + 1} is a 400, never a 429 (${r})`);
    }
    // A wrong link is, and 50 of them stop the address.
    let badLinks = 0;
    let status = 400;
    for (let i = 0; i < 52 && status !== 429; i++) {
      status = await reset(base, { token: `bad-${i}-${"y".repeat(60)}`, password: "Correct-Horse-9", confirmPassword: "Correct-Horse-9" }, resetIp);
      if (status === 400) badLinks++;
    }
    assert(badLinks === 50 && status === 429, `an address is refused after 50 wrong reset links (${badLinks})`);
    console.log("ok live: reset-password counts only wrong links");
  } finally {
    for (const u of [user, colleague]) {
      await prisma.errorLog.deleteMany({ where: { userId: u.id } });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.errorLog.deleteMany({ where: { errorType: "AUTH_SIGNIN_NO_ACCOUNT", message: { contains: "n***@example.test" } } });
    await prisma.errorLog.deleteMany({ where: { errorType: "AUTH_ADDRESS_CAP", message: { contains: sprayMasked } } });
    await prisma.errorLog.deleteMany({ where: { errorType: "AUTH_ADDRESS_CAP", message: { contains: resetMasked } } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: forgotEmails.map((e) => `forgot-account:${accountKey(e)}`) } } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `forgot-address:${inboxRange}` } } });
    for (const addr of [ip, sprayIp, forgotIp, resetIp]) {
      await prisma.rateLimitBucket.deleteMany({
        where: { OR: [{ key: { endsWith: `:${addr}` } }, { key: { contains: `:${addr}:` } }] },
      });
    }
  }
}

async function main() {
  unit();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set ALLOW_FIXTURES=true BASE_URL=http://localhost:…");
  console.log("OK test-signin-errors");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
