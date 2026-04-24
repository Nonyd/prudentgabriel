import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  colorId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
      variant: true,
      color: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { productId, variantId, colorId, quantity } = parsed.data;
  const colorIdNorm = colorId ?? null;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, stock: true, productId: true },
  });

  if (!variant || variant.productId !== productId) {
    return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
  }

  if (variant.stock < 1) {
    return NextResponse.json({ error: "Out of stock" }, { status: 400 });
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      userId: session.user.id,
      variantId,
      colorId: colorIdNorm,
    },
  });

  if (existing) {
    const nextQty = Math.min(existing.quantity + quantity, variant.stock);
    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: nextQty },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        variant: true,
        color: true,
      },
    });
    return NextResponse.json({ success: true, cartItem: updated });
  }

  const created = await prisma.cartItem.create({
    data: {
      userId: session.user.id,
      productId,
      variantId,
      colorId: colorIdNorm,
      quantity: Math.min(quantity, variant.stock),
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
      variant: true,
      color: true,
    },
  });

  return NextResponse.json({ success: true, cartItem: created });
}
