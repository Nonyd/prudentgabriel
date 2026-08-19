import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const authAttempt =
    path.includes("/callback/credentials") ||
    path.endsWith("/signin") ||
    path.includes("/signin/");
  if (authAttempt) {
    const limited = rateLimitOr429(req, "auth-credentials", 10, 15 * 60 * 1000);
    if (limited) return limited;
  }
  return handlers.POST(req);
}
