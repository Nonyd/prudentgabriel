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

  return (
    <section className="bg-bg-page py-20">
      <div className="mx-auto mb-12 max-w-site px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.2em",
                color: "var(--lightbr)",
              }}
            >
              Most Desired
            </p>
            <h2
              className="mt-3 leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "42px",
                color: "var(--choc)",
              }}
            >
              Best sellers
            </h2>
          </div>
          <Link
            href="/shop"
            className="uppercase transition-opacity hover:opacity-80"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.16em",
              color: "var(--nut)",
            }}
          >
            Shop All →
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p
          className="mx-auto max-w-site px-6 font-light lg:px-10"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "var(--text-mid)",
          }}
        >
          New arrivals coming soon — explore our collections above.
        </p>
      ) : (
        <ProductCardGrid
          products={products}
          merchBadge="Best seller"
          className="grid-cols-2 md:grid-cols-4"
        />
      )}
    </section>
  );
}
