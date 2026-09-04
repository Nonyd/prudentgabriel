import { prisma } from "@/lib/prisma";
import { buildDefaultProductSku } from "@/lib/product-sku";
import { revalidateProduct } from "@/lib/revalidate";

async function uniqueCopySlug(base: string): Promise<string> {
  const root = `${base}-copy`.slice(0, 190);
  let candidate = root;
  let n = 2;
  while (await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${n}`.slice(0, 200);
    n += 1;
  }
  return candidate;
}

export async function duplicateProduct(sourceId: string): Promise<{ id: string; slug: string } | null> {
  const source = await prisma.product.findUnique({
    where: { id: sourceId },
    include: {
      variants: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      colors: true,
    },
  });
  if (!source) return null;

  const slug = await uniqueCopySlug(source.slug);
  const name = source.name.includes("(copy)") ? source.name : `${source.name} (copy)`;

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name,
        slug,
        description: source.description,
        details: source.details,
        metaTitle: source.metaTitle,
        metaDescription: source.metaDescription,
        category: source.category,
        type: source.type,
        tags: source.tags,
        basePriceNGN: source.basePriceNGN,
        priceNGN: source.priceNGN,
        priceUSD: source.priceUSD,
        defaultWeightKg: source.defaultWeightKg,
        defaultLengthCm: source.defaultLengthCm,
        defaultWidthCm: source.defaultWidthCm,
        defaultHeightCm: source.defaultHeightCm,
        priceGBP: source.priceGBP,
        isOnSale: source.isOnSale,
        saleEndsAt: source.saleEndsAt,
        isBespokeAvail: source.isBespokeAvail,
        customOffered: source.customOffered,
        customOfferedWhenSoldOut: source.customOfferedWhenSoldOut,
        lowStockAt: source.lowStockAt,
        inStock: false,
        isPublished: false,
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,
        orderCount: 0,
      },
    });

    for (const v of source.variants) {
      await tx.productVariant.create({
        data: {
          productId: product.id,
          size: v.size,
          sku: buildDefaultProductSku(slug, v.size),
          priceNGN: v.priceNGN,
          priceUSD: v.priceUSD,
          priceGBP: v.priceGBP,
          salePriceNGN: v.salePriceNGN,
          stock: 0,
          lowStockAt: v.lowStockAt,
          sortOrder: v.sortOrder,
          weightKg: v.weightKg,
          lengthCm: v.lengthCm,
          widthCm: v.widthCm,
          heightCm: v.heightCm,
        },
      });
    }

    for (const im of source.images) {
      await tx.productImage.create({
        data: {
          productId: product.id,
          url: im.url,
          alt: im.alt,
          isPrimary: im.isPrimary,
          sortOrder: im.sortOrder,
        },
      });
    }

    for (const c of source.colors) {
      await tx.productColor.create({
        data: {
          productId: product.id,
          name: c.name,
          hex: c.hex,
          imageUrl: c.imageUrl,
        },
      });
    }

    return product;
  });

  try {
    await revalidateProduct(created.slug);
  } catch {
    // Scripts and tests have no Next static-generation store.
  }
  return { id: created.id, slug: created.slug };
}
