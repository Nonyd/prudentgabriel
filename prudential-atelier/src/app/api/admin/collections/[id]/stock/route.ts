import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { revalidateProduct } from "@/lib/revalidate";
import { processRestockAlerts } from "@/lib/stock-alerts";

const patchSchema = z.object({
  updates: z
    .array(
      z.object({
        variantId: z.string().min(1),
        stock: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, name: true, slug: true, autoTag: true },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const manuals = await prisma.collectionProduct.findMany({
    where: { collectionId },
    orderBy: { sortOrder: "asc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPublished: true,
          variants: { orderBy: { sortOrder: "asc" }, select: { id: true, size: true, sku: true, stock: true } },
        },
      },
    },
  });

  const seen = new Set(manuals.map((m) => m.productId));
  let auto: typeof manuals = [];
  const tag = collection.autoTag?.trim();
  if (tag) {
    const products = await prisma.product.findMany({
      where: { tags: { has: tag }, id: { notIn: Array.from(seen) } },
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        variants: { orderBy: { sortOrder: "asc" }, select: { id: true, size: true, sku: true, stock: true } },
      },
    });
    auto = products.map((p) => ({
      id: p.id,
      collectionId,
      productId: p.id,
      sortOrder: 0,
      createdAt: new Date(),
      product: p,
    }));
  }

  return NextResponse.json({
    collection,
    products: [...manuals.map((m) => m.product), ...auto.map((a) => a.product)],
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const restocked: string[] = [];
  const slugs = new Set<string>();

  for (const u of parsed.data.updates) {
    const current = await prisma.productVariant.findUnique({
      where: { id: u.variantId },
      select: { stock: true, product: { select: { slug: true } } },
    });
    if (!current) continue;
    await prisma.productVariant.update({
      where: { id: u.variantId },
      data: { stock: u.stock },
    });
    slugs.add(current.product.slug);
    if (current.stock === 0 && u.stock > 0) restocked.push(u.variantId);
  }

  if (restocked.length) void processRestockAlerts(restocked);
  await Promise.all(Array.from(slugs).map((s) => revalidateProduct(s)));

  return NextResponse.json({ ok: true, updated: parsed.data.updates.length });
}
