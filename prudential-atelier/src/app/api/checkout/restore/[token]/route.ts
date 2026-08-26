import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCartSnapshot } from "@/lib/checkout-session";

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
  return NextResponse.json({
    currency: session.currency,
    lines: snapshot.lines,
    subtotalNGN: snapshot.subtotalNGN,
  });
}
