import { NextResponse } from "next/server";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { parseCartSnapshot } from "@/lib/checkout-session";
import { publishedProductIds } from "@/lib/product-visibility";
import { findCheckoutSessionByRestoreToken } from "@/lib/capability-token-lookup";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const limited = await rateLimitOr429(req, "restore-token", 30, 15 * 60 * 1000);
  if (limited) return limited;
  const { token } = await ctx.params;
  const session = await findCheckoutSessionByRestoreToken(decodeURIComponent(token));
  if (!session) {
    return NextResponse.json({ error: "This restore link is no longer valid." }, { status: 404 });
  }
  const snapshot = parseCartSnapshot(session.cartSnapshot);
  // The reminder email already drops withdrawn pieces; its restore link must not
  // put them back in the bag.
  const live = await publishedProductIds(snapshot.lines.map((l) => l.productId));
  const lines = snapshot.lines.filter((l) => live.has(l.productId));
  return NextResponse.json({
    currency: session.currency,
    lines,
    subtotalNGN: lines.reduce((s, l) => s + l.priceNGN * l.quantity, 0),
    withdrawn: snapshot.lines.length - lines.length,
  });
}
