import Link from "next/link";
import { Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ProductsTable, type ProductRow } from "@/components/admin/ProductsTable";
import { MigrateImagesBanner } from "@/components/admin/MigrateImagesBanner";
import { derivedCatalogMinNGN } from "@/lib/pricing";
import { RTW_EXCLUDED_CATEGORIES } from "@/lib/rtw-aisle";

const PAGE_SIZE = 20;
const REORDER_TAKE = 200;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const search = (Array.isArray(sp.search) ? sp.search[0] : sp.search)?.trim() ?? "";
  const category = (Array.isArray(sp.category) ? sp.category[0] : sp.category) ?? undefined;
  const type = (Array.isArray(sp.type) ? sp.type[0] : sp.type) as ProductType | undefined;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const published =
    statusParam === "draft"
      ? "false"
      : Array.isArray(sp.published)
        ? sp.published[0]
        : sp.published;
  const needsPrice = Array.isArray(sp.needsPrice) ? sp.needsPrice[0] : sp.needsPrice;
  const aisle = (Array.isArray(sp.aisle) ? sp.aisle[0] : sp.aisle) ?? "";
  const reorder = (Array.isArray(sp.reorder) ? sp.reorder[0] : sp.reorder) === "1";

  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }
  if (aisle === "rtw") {
    where.type = ProductType.RTW;
    where.category = { notIn: [...RTW_EXCLUDED_CATEGORIES] };
  } else {
    if (category) where.category = category;
    if (type && Object.values(ProductType).includes(type)) where.type = type;
  }
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;
  if (needsPrice === "true") {
    where.isPublished = false;
    where.basePriceNGN = 0;
  }

  const canReorder = aisle === "rtw" || Boolean(category) || type === ProductType.RTW;
  const useReorderMode = reorder && canReorder;
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    useReorderMode || canReorder
      ? [{ isFeatured: "desc" }, { displayOrder: "asc" }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

  const [total, rows, legacyImageCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: useReorderMode ? 0 : (page - 1) * PAGE_SIZE,
      take: useReorderMode ? REORDER_TAKE : PAGE_SIZE,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { select: { id: true, priceNGN: true, salePriceNGN: true }, orderBy: { sortOrder: "asc" } },
        optionGroup: { select: { options: { select: { priceAdjustmentNGN: true } } } },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.productImage.count({
      where: { url: { contains: "wp-content/uploads" } },
    }),
  ]);

  const items: ProductRow[] = rows.map((p) => {
    const minPrice = p.variants.length
      ? derivedCatalogMinNGN(p.variants, p.isOnSale, p.optionGroup?.options)
      : p.basePriceNGN;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      type: p.type,
      isPublished: p.isPublished,
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      displayOrder: p.displayOrder,
      primaryImage: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      minPriceNGN: minPrice,
      basePriceNGN: p.basePriceNGN,
      defaultVariantId: p.variants[0]?.id ?? null,
      orderItemsCount: p._count.orderItems,
    };
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/products/guide"
            className="rounded-sm border border-sand px-4 py-2 font-label text-xs uppercase tracking-wide text-gold hover:bg-gold/10"
          >
            How to upload
          </Link>
          <Link
            href="/admin/products/new"
            className="rounded-sm bg-wine px-4 py-2 font-label text-xs uppercase tracking-wide text-gold hover:bg-wine-hover"
          >
            + Add product
          </Link>
        </div>
      </div>
      <MigrateImagesBanner initialCount={legacyImageCount} />
      <ProductsTable
        items={items}
        page={page}
        total={total}
        perPage={useReorderMode ? Math.max(total, items.length) : PAGE_SIZE}
        search={search}
        category={category ?? ""}
        type={type ?? ""}
        published={published ?? ""}
        needsPrice={needsPrice ?? ""}
        aisle={aisle}
        reorderMode={useReorderMode}
        canReorder={canReorder}
      />
    </div>
  );
}
