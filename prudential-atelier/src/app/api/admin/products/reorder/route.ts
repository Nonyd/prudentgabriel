import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const bodySchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * Persist curated aisle order. Featured still pins above via isFeatured;
 * displayOrder decides everything beneath (and relative order among featured).
 */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { orderedIds } = parsed.data;
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json({ error: "Duplicate ids" }, { status: 400 });
  }

  const existing = await prisma.product.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: "Unknown product in order" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.product.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );

  revalidatePath("/rtw");
  revalidatePath("/shop");
  return NextResponse.json({ ok: true });
}
