import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export async function DELETE(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body: expect { ids: string[] }" }, { status: 400 });
  }

  const { ids } = parsed.data;

  const items = await prisma.mediaItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, publicId: true },
  });

  if (items.length !== ids.length) {
    return NextResponse.json({ error: "One or more media IDs were not found" }, { status: 404 });
  }

  for (const item of items) {
    try {
      await cloudinary.uploader.destroy(item.publicId);
    } catch (e) {
      console.warn("[admin/media/bulk] destroy", item.publicId, e);
    }
  }

  const result = await prisma.mediaItem.deleteMany({
    where: { id: { in: items.map((i) => i.id) } },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
