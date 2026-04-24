import Link from "next/link";
import { Prisma, ProductCategory, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ProductsTable, type ProductRow } from "@/components/admin/ProductsTable";

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const search = (Array.isArray(sp.search) ? sp.search[0] : sp.search)?.trim() ?? "";
  const category = (Array.isArray(sp.category) ? sp.category[0] : sp.category) as ProductCategory | undefined;
  const type = (Array.isArray(sp.type) ? sp.type[0] : sp.type) as ProductType | undefined;
  const published = Array.isArray(sp.published) ? sp.published[0] : sp.published;
  const stock = Array.isArray(sp.stock) ? sp.stock[0] : sp.stock;

  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category && Object.values(ProductCategory).includes(category)) where.category = category;
  if (type && Object.values(ProductType).includes(type)) where.type = type;
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;
  if (stock === "out") where.variants = { some: { stock: 0 } };
  if (stock === "in") where.NOT = { variants: { some: { stock: 0 } } };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { select: { priceNGN: true, salePriceNGN: true, stock: true } },
        _count: { select: { orderItems: true } },
      },
    }),
  ]);

  const items: ProductRow[] = rows.map((p) => {
    const prices = p.variants.map((v) => v.salePriceNGN ?? v.priceNGN);
    const minPrice = prices.length ? Math.min(...prices) : p.basePriceNGN;
    const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      type: p.type,
      isPublished: p.isPublished,
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      primaryImage: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      minPriceNGN: minPrice,
      totalStock,
      orderItemsCount: p._count.orderItems,
    };
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-ivory">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded-sm bg-wine px-4 py-2 font-label text-xs uppercase tracking-wide text-gold hover:bg-wine-hover"
        >
          + Add product
        </Link>
      </div>
      <ProductsTable
        items={items}
        page={page}
        total={total}
        perPage={PAGE_SIZE}
        search={search}
        category={category ?? ""}
        type={type ?? ""}
        published={published ?? ""}
        stock={stock ?? ""}
      />
    </div>
  );
}
