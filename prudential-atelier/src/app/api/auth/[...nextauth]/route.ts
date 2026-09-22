import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMITED_ERROR } from "@/lib/signin-errors";
import { rateLimitOr429 } from "@/lib/rate-limit";

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const authAttempt =
    path.includes("/callback/credentials") ||
    path.endsWith("/signin") ||
    path.includes("/signin/");
  if (authAttempt) {
    const limited = await rateLimitOr429(req, "auth-credentials", 10, 15 * 60 * 1000);
    if (limited) {
      // next-auth's signIn() reads { url } and takes ?error / ?code from it; a bare
      // { error } made the client throw, so a lockout surfaced as "invalid credentials".
      const retryAfter = limited.headers.get("Retry-After") ?? "900";
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("error", RATE_LIMITED_ERROR);
      url.searchParams.set("code", retryAfter);
      return NextResponse.json({ url: url.toString() }, { status: 429, headers: { "Retry-After": retryAfter } });
    }
  }
  return handlers.POST(req);
}
