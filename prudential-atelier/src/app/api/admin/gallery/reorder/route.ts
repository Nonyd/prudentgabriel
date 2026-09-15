import { NextRequest, NextResponse } from "next/server";
import { GalleryCategory } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidateGallery } from "@/lib/revalidate";

const bodySchema = z.object({
  category: z.nativeEnum(GalleryCategory),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { category, orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json({ error: "Duplicate ids" }, { status: 400 });
  }

  const rows = await prisma.galleryImage.findMany({
    where: { category },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  const owned = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
    return NextResponse.json(
      { error: "Send every item in this gallery, in the new order" },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.galleryImage.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  await revalidateGallery(category);

  return NextResponse.json({ success: true });
}
