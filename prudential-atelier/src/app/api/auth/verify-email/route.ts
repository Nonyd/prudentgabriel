import { NextRequest, NextResponse } from "next/server";
import { consumeVerifyEmailToken } from "@/lib/email-verification";
import { rateLimitOr429 } from "@/lib/rate-limit";

/** Spends a verification link (see /auth/verify-email/[token]). */
export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "verify-email", 30, 15 * 60 * 1000);
  if (limited) return limited;
  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token;
  } catch {
    return NextResponse.json({ result: "invalid" }, { status: 400 });
  }
  const result = await consumeVerifyEmailToken(token);
  return NextResponse.json({ result }, { status: result === "verified" || result === "already" ? 200 : 400 });
}
