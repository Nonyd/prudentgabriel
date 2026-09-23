import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitOr429 } from "@/lib/rate-limit";
import { ensureTrackingRaw } from "@/lib/capability-token-lookup";

const bodySchema = z.object({
  ref: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(254),
});

const NOT_FOUND = "We could not find an order with that reference and email.";
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Token sweep: the reference alone (ORD-1000..9999) used to open the tracking
 * page. It now takes the reference and the email on the order, by POST, so
 * neither sits in a URL or a log. A match hands back the tracking link.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "track-ref", 20, WINDOW_MS);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your order reference and the email on the order." }, { status: 400 });
  }
  const ref = parsed.data.ref.toUpperCase();
  // Per reference too, so many addresses cannot walk the emails for one order.
  const perRef = await checkRateLimit(`track-ref-order:${ref}`, 10, WINDOW_MS);
  if (!perRef.ok) {
    return NextResponse.json({ error: NOT_FOUND }, { status: 429 });
  }

  const order = await prisma.bespokeOrder.findFirst({
    where: {
      orderRef: { equals: ref, mode: "insensitive" },
      clientEmail: { equals: parsed.data.email, mode: "insensitive" },
    },
    select: { id: true, trackingToken: true, trackingTokenEnc: true, trackingTokenExpiresAt: true },
  });
  if (!order) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });

  const raw = await ensureTrackingRaw(order);
  return NextResponse.json({ url: `/track/${encodeURIComponent(raw)}` });
}
