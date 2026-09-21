import { NextRequest, NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { unsubscribeByToken } from "@/lib/email-consent";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limited = rateLimitOr429(req, "unsubscribe-token", 20, 15 * 60 * 1000);
  if (limited) return limited;

  const { token } = await ctx.params;
  const result = await unsubscribeByToken(token);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const url = new URL(`/unsubscribe/${encodeURIComponent(token)}`, req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ success: true, already: result.already });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, req.url));
}
