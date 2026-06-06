import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { destroyCloudinaryAsset } from "@/lib/cloudinary-public-id";
import { revalidateProduct } from "@/lib/revalidate";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; imageId: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id: productId, imageId } = await ctx.params;

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, url: true, isPrimary: true },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await destroyCloudinaryAsset(image.url);
  await prisma.productImage.delete({ where: { id: imageId } });

  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (next) {
      await prisma.$transaction([
        prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
        prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } }),
      ]);
    }
  }

  await revalidateProduct(product.slug);
  return NextResponse.json({ success: true });
}
