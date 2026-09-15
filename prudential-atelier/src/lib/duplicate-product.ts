import { prisma } from "@/lib/prisma";
import { buildDefaultProductSku, loadTakenSkus, uniqueSkuFromTaken } from "@/lib/product-sku";
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
      optionGroup: {
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: { measurementFields: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
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
        isPublished: false,
        isFeatured: false,
        isNewArrival: false,
        isBestSeller: false,
        orderCount: 0,
      },
    });

    const taken = await loadTakenSkus(tx);
    for (const v of source.variants) {
      const sku = uniqueSkuFromTaken(buildDefaultProductSku(name, v.size), taken);
      await tx.productVariant.create({
        data: {
          productId: product.id,
          size: v.size,
          sku,
          skuManual: false,
          priceNGN: v.priceNGN,
          priceUSD: v.priceUSD,
          priceGBP: v.priceGBP,
          salePriceNGN: v.salePriceNGN,
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

    if (source.optionGroup && source.optionGroup.options.length > 0) {
      await tx.productOptionGroup.create({
        data: {
          productId: product.id,
          label: source.optionGroup.label,
          isRequired: source.optionGroup.isRequired,
          includeInSku: source.optionGroup.includeInSku,
          sortOrder: source.optionGroup.sortOrder,
          options: {
            create: source.optionGroup.options.map((o) => ({
              label: o.label,
              priceAdjustmentNGN: o.priceAdjustmentNGN,
              isDefault: o.isDefault,
              sortOrder: o.sortOrder,
              skuPart: o.skuPart,
              measurementFields: {
                create: o.measurementFields.map((mf) => ({
                  fieldId: mf.fieldId,
                  required: mf.required,
                  sortOrder: mf.sortOrder,
                })),
              },
            })),
          },
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
