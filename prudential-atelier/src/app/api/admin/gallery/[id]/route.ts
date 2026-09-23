import { NextRequest, NextResponse } from "next/server";
import { GalleryCategory } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { revalidateGallery } from "@/lib/revalidate";
import { priceGuideError } from "@/lib/price-guide";

/** BA4: whole naira, display only. Null clears it. */
const nairaGuide = z.number().int().positive().max(10_000_000_000).nullable().optional();

const patchSchema = z.object({
  alt: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  category: z.nativeEnum(GalleryCategory).optional(),
  priceFloorNGN: nairaGuide,
  priceCeilingNGN: nairaGuide,
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.galleryImage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guide = {
    priceFloorNGN: parsed.data.priceFloorNGN !== undefined ? parsed.data.priceFloorNGN : existing.priceFloorNGN,
    priceCeilingNGN: parsed.data.priceCeilingNGN !== undefined ? parsed.data.priceCeilingNGN : existing.priceCeilingNGN,
  };
  const guideError = priceGuideError(guide);
  if (guideError) {
    return NextResponse.json({ error: guideError }, { status: 400 });
  }

  const nextCategory = parsed.data.category;
  const moving = Boolean(nextCategory && nextCategory !== existing.category);
  let sortOrder = parsed.data.sortOrder;
  if (moving && nextCategory) {
    const maxSort = await prisma.galleryImage.aggregate({
      where: { category: nextCategory },
      _max: { sortOrder: true },
    });
    sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  }

  const row = await prisma.galleryImage.update({
    where: { id },
    data: {
      ...(parsed.data.alt !== undefined ? { alt: parsed.data.alt } : {}),
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.isPublished !== undefined ? { isPublished: parsed.data.isPublished } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(moving && nextCategory ? { category: nextCategory } : {}),
      priceFloorNGN: guide.priceFloorNGN,
      priceCeilingNGN: guide.priceCeilingNGN,
    },
  });

  await revalidateGallery(existing.category as "ATELIER" | "BRIDAL" | "KIDS");
  if (moving) {
    await revalidateGallery(row.category as "ATELIER" | "BRIDAL" | "KIDS");
  }
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const row = await prisma.galleryImage.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await destroyStoredMedia(row.url, row.publicId);

  await prisma.galleryImage.delete({ where: { id } });
  await revalidateGallery(row.category as "ATELIER" | "BRIDAL" | "KIDS");
  return NextResponse.json({ ok: true });
}
