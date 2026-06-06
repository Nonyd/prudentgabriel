import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidateProduct } from "@/lib/revalidate";

const bodySchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id: productId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const existingCount = await prisma.productImage.count({ where: { productId } });
  const makePrimary = parsed.data.isPrimary ?? existingCount === 0;

  const image = await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
    }

    return tx.productImage.create({
      data: {
        productId,
        url: parsed.data.url,
        alt: parsed.data.alt ?? null,
        isPrimary: makePrimary,
        sortOrder: parsed.data.sortOrder ?? existingCount,
      },
    });
  });

  await revalidateProduct(product.slug);
  return NextResponse.json(image);
}
