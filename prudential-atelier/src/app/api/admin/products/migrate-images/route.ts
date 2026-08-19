import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { uploadProductImageFromUrl } from "@/lib/product-image-migrate";
import { revalidateProduct } from "@/lib/revalidate";

export async function GET() {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  const total = await prisma.productImage.count({
    where: { url: { contains: "wp-content/uploads" } },
  });

  return NextResponse.json({ total });
}

export async function POST() {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  const legacy = await prisma.productImage.findMany({
    where: { url: { contains: "wp-content/uploads" } },
    include: { product: { select: { slug: true } } },
    orderBy: { sortOrder: "asc" },
  });

  const total = legacy.length;
  let migrated = 0;
  let failed = 0;
  const slugs = new Set<string>();

  for (const row of legacy) {
    try {
      const secureUrl = await uploadProductImageFromUrl(row.url);
      await prisma.productImage.update({
        where: { id: row.id },
        data: { url: secureUrl },
      });
      migrated += 1;
      slugs.add(row.product.slug);
    } catch (e) {
      failed += 1;
      console.warn("[migrate-images] failed", row.id, row.url, e);
    }
  }

  await Promise.all(Array.from(slugs).map((slug) => revalidateProduct(slug)));

  return NextResponse.json({ total, migrated, failed });
}
