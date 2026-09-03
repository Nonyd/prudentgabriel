import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { revalidateGallery } from "@/lib/revalidate";

const patchSchema = z.object({
  alt: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
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

  const row = await prisma.galleryImage.update({
    where: { id },
    data: {
      ...(parsed.data.alt !== undefined ? { alt: parsed.data.alt } : {}),
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.isPublished !== undefined ? { isPublished: parsed.data.isPublished } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });
  await revalidateGallery(row.category as "ATELIER" | "BRIDAL" | "KIDS");
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
