/**
 * Sign-in failures say what actually happened.
 *
 *   pnpm test:signin-errors                                          # messages
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:signin-errors
 *
 * Live: signs in through the real Auth.js flow (CSRF + credentials callback)
 * as a fixture user, checks the refusal is logged with a masked email, and
 * that a rate-limited attempt carries error=RateLimited (not "invalid
 * credentials"). Local server only — X-Forwarded-For picks a fresh bucket.
 */
import "./preload-test-env";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { RATE_LIMITED_ERROR, signInErrorMessage } from "../src/lib/signin-errors";
import { assertFixturesAllowed } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function unit() {
  assert(/Too many sign-in attempts/.test(signInErrorMessage({ error: RATE_LIMITED_ERROR, code: "600", status: 429 })), "rate limit says so");
  assert(/wait 10 minutes/.test(signInErrorMessage({ error: RATE_LIMITED_ERROR, code: "600" })), "rate limit gives the wait");
  assert(/Invalid email or password/.test(signInErrorMessage({ error: "CredentialsSignin", status: 200 })), "wrong password stays generic");
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

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "local server only");
  assertFixturesAllowed("test-signin-errors");
  const email = `signin-${Date.now()}@example.test`;
  const password = "Correct-Horse-9";
  const user = await prisma.user.create({
    data: { email, name: "Signin Test", role: Role.CUSTOMER, password: await bcrypt.hash(password, 12) },
  });
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
  try {
    const ok = await signInOnce(base, email, password, ip);
    assert(ok.status === 200 && !ok.error, `correct password signs in (${JSON.stringify(ok)})`);

    const bad = await signInOnce(base, email, "Wrong-Password-1", ip);
    assert(bad.error === "CredentialsSignin", `wrong password is refused (${JSON.stringify(bad)})`);
    const logged = await prisma.errorLog.findFirst({
      where: { errorType: "AUTH_SIGNIN_WRONG_PASSWORD", userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    assert(logged, "the refusal is logged with its reason");
    assert(!logged.message.includes(email) && logged.message.includes("s***@example.test"), "email is masked in the log");
    assert(!logged.message.includes("Wrong-Password-1"), "password never logged");

    // Exhaust the 10-per-15-minutes budget for this IP.
    let last = bad;
    for (let i = 0; i < 12 && last.error !== RATE_LIMITED_ERROR; i++) last = await signInOnce(base, email, "Wrong-Password-1", ip);
    assert(last.status === 429 && last.error === RATE_LIMITED_ERROR && Number(last.code) > 0, `lockout carries RateLimited + wait (${JSON.stringify(last)})`);
    assert(/Too many sign-in attempts/.test(signInErrorMessage(last)), "the form tells the person to wait");
    const correctWhileLocked = await signInOnce(base, email, password, ip);
    assert(correctWhileLocked.error === RATE_LIMITED_ERROR, "even the right password is told to wait, not 'invalid'");
    console.log("ok live: sign-in, logged refusal (masked), and a lockout that says so");
  } finally {
    await prisma.errorLog.deleteMany({ where: { userId: user.id } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { endsWith: `:${ip}` } } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
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
