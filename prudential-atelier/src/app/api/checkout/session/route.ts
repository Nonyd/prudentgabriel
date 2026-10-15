import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { upsertCheckoutSession, type CheckoutCartSnapshot } from "@/lib/checkout-session";
import { sanitizeAttribution } from "@/lib/analytics/attribution";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/product-visibility";
import { checkRateLimit, rateLimitOr429 } from "@/lib/rate-limit";

/** A typed email is sent a reminder later: cap how many sessions one address can start. */
const SESSIONS_PER_IP = 30;
const SESSIONS_PER_EMAIL = 5;
const HOUR_MS = 60 * 60 * 1000;

type ParsedLine = z.infer<typeof lineSchema>;

/**
 * The reminder email shows product names, pictures and prices. Those come from
 * the catalogue, never from the request, so the form cannot be used to mail
 * arbitrary text or images to an address.
 */
async function catalogueLines(lines: ParsedLine[]): Promise<CheckoutCartSnapshot["lines"]> {
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(lines.map((l) => l.productId))] }, ...PUBLIC_PRODUCT_WHERE },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      priceUSD: true,
      priceGBP: true,
      variants: { select: { id: true, size: true, priceNGN: true } },
      colors: { select: { id: true, name: true, hex: true, imageUrl: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: CheckoutCartSnapshot["lines"] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) continue;
    const color = line.colorId ? product.colors.find((c) => c.id === line.colorId) : undefined;
    out.push({
      id: line.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantId: variant.id,
      size: variant.size,
      colorId: color?.id ?? null,
      color: color?.name,
      colorHex: color?.hex,
      imageUrl: color?.imageUrl || product.images[0]?.url || "",
      priceNGN: variant.priceNGN,
      priceUSD: product.priceUSD ?? undefined,
      priceGBP: product.priceGBP ?? undefined,
      quantity: line.quantity,
      category: product.category,
    });
  }
  return out;
}

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
  attribution: z
    .object({
      source: z.string().max(80).optional(),
      medium: z.string().max(80).optional(),
      campaign: z.string().max(120).optional(),
      content: z.string().max(120).optional(),
      referrer: z.string().max(120).optional(),
      landingPath: z.string().max(200).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "checkout-session", SESSIONS_PER_IP, HOUR_MS);
  if (limited) return limited;

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

  const sessionEmail = session?.user?.email ?? email;
  if (!session?.user?.email) {
    const perEmail = await checkRateLimit(`checkout-session-email:${sessionEmail}`, SESSIONS_PER_EMAIL, HOUR_MS);
    if (!perEmail.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const lines = await catalogueLines(parsed.data.cartSnapshot.lines);
  if (lines.length === 0) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }
  const snapshot: CheckoutCartSnapshot = {
    lines,
    subtotalNGN: lines.reduce((s, l) => s + l.priceNGN * l.quantity, 0),
  };

  const row = await upsertCheckoutSession({
    id: parsed.data.id,
    email: sessionEmail,
    userId: session?.user?.id ?? null,
    cartSnapshot: snapshot,
    currency: parsed.data.currency,
    furthestStep: parsed.data.furthestStep,
    attribution: sanitizeAttribution(parsed.data.attribution),
  });

  return NextResponse.json({ id: row.id });
}
