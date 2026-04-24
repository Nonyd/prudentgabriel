import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

const patchSchema = z.object({
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const item = await prisma.mediaItem.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.alt !== undefined ? { alt: parsed.data.alt } : {}),
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const item = await prisma.mediaItem.findUnique({
    where: { id: params.id },
    select: { publicId: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await cloudinary.uploader.destroy(item.publicId);
  } catch (e) {
    console.warn("[admin/media DELETE] cloudinary destroy", e);
  }

  await prisma.mediaItem.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
