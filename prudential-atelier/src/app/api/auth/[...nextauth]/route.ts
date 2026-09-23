import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMITED_ERROR } from "@/lib/signin-errors";
import { checkRateLimit, getClientIp, refundRateLimit } from "@/lib/rate-limit";
import {
  AUTH_ADDRESS_LIMIT,
  AUTH_OAUTH_START_LIMIT,
  AUTH_WINDOW_MS,
  SIGNIN_ACCOUNT_LIMIT,
  accountKey,
  noteAddressCapHit,
} from "@/lib/auth-limits";

export const { GET } = handlers;

async function attemptedEmail(req: NextRequest): Promise<string> {
  try {
    const form = await req.clone().formData();
    const email = form.get("email");
    return typeof email === "string" ? email : "";
  } catch {
    return "";
  }
}

/** Auth.js answers { url } (X-Auth-Return-Redirect) or a 302; a refusal carries ?error=. */
async function signInSucceeded(res: Response): Promise<boolean> {
  if (res.status >= 400) return false;
  let url = res.headers.get("location");
  if (!url) {
    const body = (await res.clone().json().catch(() => null)) as { url?: string } | null;
    url = body?.url ?? null;
  }
  if (!url) return false;
  try {
    return !new URL(url, "http://x").searchParams.has("error");
  } catch {
    return false;
  }
}

/**
 * BA1: only failures count. Sign-ins used to be limited to 10 per address per
 * 15 minutes whether or not the password was right, so a team on one Wi-Fi (or
 * everyone on one carrier NAT) locked each other out with correct passwords.
 * Each attempt still takes a unit first (so parallel guesses stay bounded) and
 * a successful sign-in gives it back.
 */
export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const credentials = path.includes("/callback/credentials");
  const authAttempt = credentials || path.endsWith("/signin") || path.includes("/signin/");
  if (!authAttempt) return handlers.POST(req);

  const ip = getClientIp(req);
  const email = credentials ? await attemptedEmail(req) : "";
  // Starting Google (or another provider) sign-in is not a password guess and
  // its outcome is not known here, so it never touches the password budget. It
  // has its own, wider bucket (BA1 follow-up: Google starts used to consume the
  // shared address budget and never gave it back).
  const keys = [credentials ? `auth-address:${ip}` : `auth-oauth:${ip}`];
  const limits = [credentials ? AUTH_ADDRESS_LIMIT : AUTH_OAUTH_START_LIMIT];
  if (email) {
    keys.push(`auth-account:${ip}:${accountKey(email)}`);
    limits.push(SIGNIN_ACCOUNT_LIMIT);
  }

  let retryAfterSec = 0;
  const taken: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const result = await checkRateLimit(keys[i], limits[i], AUTH_WINDOW_MS);
    if (result.ok) {
      taken.push(keys[i]);
    } else {
      retryAfterSec = Math.max(retryAfterSec, result.retryAfterSec);
      if (i === 0) await noteAddressCapHit(credentials ? "sign-in" : "oauth-start", ip, result.retryAfterSec, limits[0]);
    }
  }
  if (retryAfterSec > 0) {
    // A refused attempt is not an attempt: someone retrying a locked account must
    // not use up the address budget their colleagues share.
    await Promise.all(taken.map((k) => refundRateLimit(k)));
    // next-auth's signIn() reads { url } and takes ?error / ?code from it; a bare
    // { error } made the client throw, so a lockout surfaced as "invalid credentials".
    const retryAfter = String(retryAfterSec);
    const url = new URL("/auth/login", req.nextUrl.origin);
    url.searchParams.set("error", RATE_LIMITED_ERROR);
    url.searchParams.set("code", retryAfter);
    return NextResponse.json({ url: url.toString() }, { status: 429, headers: { "Retry-After": retryAfter } });
  }

  const res = await handlers.POST(req);
  if (credentials && (await signInSucceeded(res))) {
    await Promise.all(keys.map((k) => refundRateLimit(k)));
  }
  return res;
}
