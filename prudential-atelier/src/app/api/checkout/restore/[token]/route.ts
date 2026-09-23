import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCartSnapshot } from "@/lib/checkout-session";
import { publishedProductIds } from "@/lib/product-visibility";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const session = await prisma.checkoutSession.findUnique({
    where: { restoreToken: decodeURIComponent(token) },
  });
  if (!session || session.recoveredAt) {
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
