import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { revalidateProduct } from "@/lib/revalidate";
import { isLegacyWordPressImageUrl, uploadProductImageFromUrl } from "@/lib/product-image-migrate";

const bodySchema = z.object({
  sourceUrl: z.string().url(),
  imageId: z.string().min(1),
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

  const { sourceUrl, imageId } = parsed.data;

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, url: true },
  });
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const urlToMigrate = isLegacyWordPressImageUrl(image.url) ? image.url : sourceUrl;

  try {
    const secureUrl = await uploadProductImageFromUrl(urlToMigrate);
    const updated = await prisma.productImage.update({
      where: { id: imageId },
      data: { url: secureUrl },
    });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });
    if (product) await revalidateProduct(product.slug);

    return NextResponse.json({ url: updated.url });
  } catch (e) {
    console.error("[admin/products reupload]", e);
    return NextResponse.json({ error: "Could not migrate image — source may be unreachable" }, { status: 502 });
  }
}
