import Link from "next/link";
import { ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BestSellersGrid } from "./BestSellersGrid";
import { isSkipDbBuild } from "@/lib/skip-db-build";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  BRIDAL: "Bridal",
  EVENING_WEAR: "Evening Wear",
  CASUAL: "Ready-to-Wear",
  FORMAL: "Formal",
  KIDDIES: "Kiddies",
  ACCESSORIES: "Accessories",
};

export async function BestSellers() {
  let products: {
    id: string;
    name: string;
    slug: string;
    price: number;
    category: string;
    images: string[];
  }[] = [];

  try {
    if (isSkipDbBuild()) {
      /* empty products at image-build time */
    } else {
    const featured = await prisma.product.findMany({
      where: { isPublished: true, isFeatured: true },
      take: 4,
      orderBy: { orderCount: "desc" },
      include: { images: { where: { isPrimary: true }, take: 1 }, variants: true },
    });

    let list = [...featured];
    if (list.length < 4) {
      const existingIds = list.map((p) => p.id);
      const filler = await prisma.product.findMany({
        where: { isPublished: true, id: { notIn: existingIds } },
        take: 4 - list.length,
        orderBy: { orderCount: "desc" },
        include: { images: { where: { isPrimary: true }, take: 1 }, variants: true },
      });
      list = [...list, ...filler];
    }

    products = list.slice(0, 4).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.priceNGN,
      category: CATEGORY_LABELS[p.category] ?? "Ready-to-Wear",
      images: p.images[0]?.url ? [p.images[0].url] : [],
    }));
    }
  } catch {
    products = [];
  }

  return (
    <section className="bg-bg-page px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
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

        {products.length === 0 ? (
          <p
            className="mt-10 font-light"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--text-mid)",
            }}
          >
            New arrivals coming soon — explore our collections above.
          </p>
        ) : (
          <BestSellersGrid products={products} />
        )}
      </div>
    </section>
  );
}
