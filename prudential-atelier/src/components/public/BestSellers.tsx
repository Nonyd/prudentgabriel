import Link from "next/link";
import { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import { collectionListProductInclude, type CollectionListProduct } from "@/lib/collection-products";
import { rankedProductIdsByUnitsSold } from "@/lib/finance/whats-selling";
import { HOMEPAGE_BESTSELLERS_TAKE } from "@/lib/homepage-bestsellers";
import { mapProductToListItem } from "@/lib/map-product-list-item";
import { RTW_EXCLUDED_CATEGORIES } from "@/lib/rtw-aisle";
import type { ProductListItem } from "@/types/product";

const TAKE = HOMEPAGE_BESTSELLERS_TAKE;

function toListItem(p: CollectionListProduct): ProductListItem {
  return mapProductToListItem(p);
}

async function featuredFallback(): Promise<ProductListItem[]> {
  const rows = await prisma.product.findMany({
    where: {
      isPublished: true,
      isFeatured: true,
      type: ProductType.RTW,
      category: { notIn: [...RTW_EXCLUDED_CATEGORIES] },
    },
    include: collectionListProductInclude,
    orderBy: { updatedAt: "desc" },
    take: TAKE,
  });
  return rows.map(toListItem);
}

export async function BestSellers() {
  let products: ProductListItem[] = [];
  let source: "sales" | "featured" = "sales";

  try {
    if (!isSkipDbBuild()) {
      const ranked = await rankedProductIdsByUnitsSold();
      const takeIds = ranked.slice(0, 24);
      if (takeIds.length > 0) {
        const rows = await prisma.product.findMany({
          where: { isPublished: true, id: { in: takeIds } },
          include: collectionListProductInclude,
        });
        const order = new Map(takeIds.map((id, i) => [id, i]));
        const list = rows
          .slice()
          .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
          .slice(0, TAKE);
        products = list.map(toListItem);
      }
      if (products.length === 0) {
        products = await featuredFallback();
        source = "featured";
      }
    }
  } catch {
    products = [];
  }

  if (products.length === 0) return null;

  return (
    <section className="py-20" data-bestsellers-source={source}>
      <div className="mx-auto mb-12 max-w-site px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "42px",
              color: "var(--choc)",
            }}
          >
            Best sellers
          </h2>
          <Link
            href="/rtw"
            className="transition-opacity hover:opacity-80"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "13px",
              fontWeight: 400,
              color: "var(--nut)",
            }}
          >
            Shop all →
          </Link>
        </div>
      </div>

      <ProductCardGrid
        products={products}
        merchBadge="Best seller"
        variant="teaser"
        className="grid-cols-2 md:grid-cols-4"
      />
    </section>
  );
}
