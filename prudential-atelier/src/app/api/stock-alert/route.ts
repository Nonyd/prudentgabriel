import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().email(),
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const variantIds = parsed.data.variantId
    ? product.variants.some((v) => v.id === parsed.data.variantId)
      ? [parsed.data.variantId]
      : null
    : product.variants.map((v) => v.id);

  if (!variantIds || variantIds.length === 0) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  for (const variantId of variantIds) {
    await prisma.stockAlert.upsert({
      where: { email_variantId: { email, variantId } },
      create: { email, variantId },
      update: {},
    });
  }

  return NextResponse.json({ success: true });
}
