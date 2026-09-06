import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { storedPublicMediaUrlSchema } from "@/lib/media/stored-url";
import { revalidateCollection } from "@/lib/revalidate";

const patchSchema = z.object({
  videoKey: storedPublicMediaUrlSchema.optional(),
  posterKey: storedPublicMediaUrlSchema.optional(),
  position: z.number().int().min(0).max(200).optional(),
  productId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function loadReel(collectionId: string, reelId: string) {
  return prisma.collectionReel.findFirst({
    where: { id: reelId, collectionId },
    include: { collection: { select: { slug: true } } },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; reelId: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId, reelId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await loadReel(collectionId, reelId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.productId) {
    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const row = await prisma.collectionReel.update({
    where: { id: reelId },
    data: {
      ...(parsed.data.videoKey != null ? { videoKey: parsed.data.videoKey } : {}),
      ...(parsed.data.posterKey != null ? { posterKey: parsed.data.posterKey } : {}),
      ...(parsed.data.position != null ? { position: parsed.data.position } : {}),
      ...(parsed.data.productId !== undefined ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.isActive != null ? { isActive: parsed.data.isActive } : {}),
    },
  });
  try {
    revalidateCollection(existing.collection.slug);
  } catch {
    /* tests */
  }
  return NextResponse.json({ item: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; reelId: string }> }) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;
  const { id: collectionId, reelId } = await ctx.params;
  const existing = await loadReel(collectionId, reelId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.collectionReel.delete({ where: { id: reelId } });
  try {
    revalidateCollection(existing.collection.slug);
  } catch {
    /* tests */
  }
  return NextResponse.json({ ok: true });
}
