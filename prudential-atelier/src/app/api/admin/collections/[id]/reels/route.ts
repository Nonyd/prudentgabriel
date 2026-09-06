import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { storedPublicMediaUrlSchema } from "@/lib/media/stored-url";
import { revalidateCollection } from "@/lib/revalidate";

const createSchema = z.object({
  videoKey: storedPublicMediaUrlSchema,
  posterKey: storedPublicMediaUrlSchema,
  position: z.number().int().min(0).max(200),
  productId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  const items = await prisma.collectionReel.findMany({
    where: { collectionId },
    orderBy: [{ sortOrder: "asc" }, { position: "asc" }],
    include: { product: { select: { id: true, name: true, slug: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  const collection = await prisma.collection.findUnique({ where: { id: collectionId }, select: { slug: true } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.productId) {
    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const maxAgg = await prisma.collectionReel.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });

  const row = await prisma.collectionReel.create({
    data: {
      collectionId,
      videoKey: parsed.data.videoKey,
      posterKey: parsed.data.posterKey,
      position: parsed.data.position,
      productId: parsed.data.productId ?? null,
      isActive: parsed.data.isActive ?? true,
      sortOrder: (maxAgg._max.sortOrder ?? -1) + 1,
    },
  });
  try {
    revalidateCollection(collection.slug);
  } catch {
    /* tests */
  }
  return NextResponse.json({ item: row }, { status: 201 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.collectionReel.updateMany({
        where: { id, collectionId },
        data: { sortOrder: index },
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
