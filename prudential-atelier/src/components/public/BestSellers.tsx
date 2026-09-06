import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { ProductCardGrid } from "@/components/common/ProductCardGrid";
import { collectionListProductInclude, type CollectionListProduct } from "@/lib/collection-products";
import { mapProductToListItem } from "@/lib/map-product-list-item";
import type { ProductListItem } from "@/types/product";

const TAKE = 4;

function toListItem(p: CollectionListProduct): ProductListItem {
  return mapProductToListItem(p);
}

export async function BestSellers() {
  let products: ProductListItem[] = [];

  try {
    if (!isSkipDbBuild()) {
      const featured = await prisma.product.findMany({
        where: { isPublished: true, isFeatured: true },
        take: TAKE,
        orderBy: { orderCount: "desc" },
        include: collectionListProductInclude,
      });

      let list: CollectionListProduct[] = [...featured];
      if (list.length < TAKE) {
        const existingIds = list.map((p) => p.id);
        const filler = await prisma.product.findMany({
          where: { isPublished: true, id: { notIn: existingIds } },
          take: TAKE - list.length,
          orderBy: { orderCount: "desc" },
          include: collectionListProductInclude,
        });
        list = [...list, ...filler];
      }

      products = list.slice(0, TAKE).map(toListItem);
    }
  } catch {
    products = [];
  }

  if (products.length === 0) return null;

  return (
    <section className="py-20">
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
