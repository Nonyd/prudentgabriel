import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const addBodySchema = z.object({
  productId: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  const rows = await prisma.collectionProduct.findMany({
    where: { collectionId },
    orderBy: { sortOrder: "asc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPublished: true,
          basePriceNGN: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  });

  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, sortOrder } = parsed.data;

  const existing = await prisma.collectionProduct.findUnique({
    where: { collectionId_productId: { collectionId, productId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Product already in collection" }, { status: 409 });
  }

  const count = await prisma.collectionProduct.count({ where: { collectionId } });
  if (count >= 100) {
    return NextResponse.json({ error: "Maximum 100 manual products" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const maxAgg = await prisma.collectionProduct.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });
  const nextSort = (maxAgg._max.sortOrder ?? -1) + 1;

  const row = await prisma.collectionProduct.create({
    data: {
      collectionId,
      productId,
      sortOrder: sortOrder ?? nextSort,
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  await prisma.collectionProduct.deleteMany({
    where: { collectionId, productId },
  });

  return NextResponse.json({ ok: true });
}
