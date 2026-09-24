import { NextRequest, NextResponse } from "next/server";
import { GalleryCategory } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { revalidateGallery } from "@/lib/revalidate";
import { priceGuideError } from "@/lib/price-guide";
import { joiningPieceId, placeholderAfterSave, planPieceChange } from "@/lib/atelier-gallery";

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
  /** BB3: what the piece is, what it is made of, what it was for. */
  description: z.string().max(2000).nullable().optional(),
  /** BB3: the piece this frame belongs to (its main photograph); null makes it a piece of its own. */
  pieceOfId: z.string().min(1).nullable().optional(),
  /** Keep (true) or drop (false) the "invented for review" mark; saving real values drops it anyway. */
  placeholder: z.boolean().optional(),
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

  // BB3: pieces are one level deep and within one gallery (atelier-gallery.ts).
  const change = {
    pieceOfId: parsed.data.pieceOfId,
    description: parsed.data.description,
    priceFloorNGN: parsed.data.priceFloorNGN,
    priceCeilingNGN: parsed.data.priceCeilingNGN,
    moving,
  };
  const joining = joiningPieceId(existing, change);
  const head = joining ? await prisma.galleryImage.findUnique({ where: { id: joining } }) : null;
  const plan = planPieceChange(existing, change, head);
  if ("error" in plan) {
    return NextResponse.json({ error: plan.error }, { status: 400 });
  }

  let sortOrder = parsed.data.sortOrder;
  if (moving && nextCategory) {
    const maxSort = await prisma.galleryImage.aggregate({
      where: { category: nextCategory },
      _max: { sortOrder: true },
    });
    sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  }

  const row = await prisma.$transaction(async (tx) => {
    if (plan.head && Object.keys(plan.head.data).length > 0) {
      await tx.galleryImage.update({ where: { id: plan.head.id }, data: plan.head.data });
    }
    if (plan.frames) {
      await tx.galleryImage.updateMany({ where: { pieceOfId: plan.frames.from }, data: { pieceOfId: plan.frames.to } });
    }
    return tx.galleryImage.update({
      where: { id },
      data: {
        ...(parsed.data.alt !== undefined ? { alt: parsed.data.alt } : {}),
        ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
        ...(parsed.data.isPublished !== undefined ? { isPublished: parsed.data.isPublished } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(moving && nextCategory ? { category: nextCategory } : {}),
        ...plan.row,
        // Invented words and prices stay marked until the house replaces them.
        placeholder: plan.row.pieceOfId ? false : placeholderAfterSave(existing, parsed.data),
      },
    });
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

  // BB3: the same file can sit on two rows (uploaded twice). Removing one row
  // must not take the photograph from the other.
  const sharing = await prisma.galleryImage.count({ where: { url: row.url, id: { not: id } } });
  if (sharing === 0) await destroyStoredMedia(row.url, row.publicId);

  await prisma.galleryImage.delete({ where: { id } });
  await revalidateGallery(row.category as "ATELIER" | "BRIDAL" | "KIDS");
  return NextResponse.json({ ok: true });
}
