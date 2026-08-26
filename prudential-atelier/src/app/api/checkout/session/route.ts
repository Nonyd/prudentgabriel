import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { upsertCheckoutSession, type CheckoutCartSnapshot } from "@/lib/checkout-session";

const lineSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  productName: z.string().min(1),
  productSlug: z.string().optional().default(""),
  variantId: z.string().min(1),
  size: z.string().optional().default(""),
  colorId: z.string().nullable().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  imageUrl: z.string().optional().default(""),
  priceNGN: z.number(),
  priceUSD: z.number().optional(),
  priceGBP: z.number().optional(),
  quantity: z.number().int().min(1).max(99),
  stock: z.number().optional(),
  category: z.string().optional(),
});

const bodySchema = z.object({
  id: z.string().min(8).optional(),
  email: z.string().email(),
  cartSnapshot: z.object({
    lines: z.array(lineSchema).min(1).max(50),
    subtotalNGN: z.number().optional(),
  }),
  currency: z.string().max(8).optional().default("NGN"),
  furthestStep: z.number().int().min(1).max(3),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }

  const session = await auth();
  const email = parsed.data.email.trim().toLowerCase();
  if (session?.user?.email && session.user.email.toLowerCase() !== email) {
    // Logged-in checkout uses the account email, not a typed guest field.
  }

  const lines = parsed.data.cartSnapshot.lines;
  const snapshot: CheckoutCartSnapshot = {
    lines,
    subtotalNGN:
      parsed.data.cartSnapshot.subtotalNGN ??
      lines.reduce((s, l) => s + l.priceNGN * l.quantity, 0),
  };

  const row = await upsertCheckoutSession({
    id: parsed.data.id,
    email: session?.user?.email ?? email,
    userId: session?.user?.id ?? null,
    cartSnapshot: snapshot,
    currency: parsed.data.currency,
    furthestStep: parsed.data.furthestStep,
  });

  return NextResponse.json({ id: row.id });
}
