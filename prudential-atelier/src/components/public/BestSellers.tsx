import Link from "next/link";
import { ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BestSellersGrid } from "./BestSellersGrid";

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
    const featured = await prisma.product.findMany({
      where: { isPublished: true, isFeatured: true },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });

    const list =
      featured.length >= 4
        ? featured
        : await prisma.product.findMany({
            where: { isPublished: true },
            take: 4,
            orderBy: { createdAt: "desc" },
            include: { images: { where: { isPrimary: true }, take: 1 } },
          });

    products = list.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.priceNGN,
      category: CATEGORY_LABELS[p.category] ?? "Ready-to-Wear",
      images: p.images[0]?.url ? [p.images[0].url] : [],
    }));
  } catch {
    products = [];
  }

  return (
    <section className="bg-ivory px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
              Most Desired
            </p>
            <h2 className="mt-3 font-serif text-[42px] font-medium leading-tight text-choc">
              Best sellers
            </h2>
          </div>
          <Link
            href="/shop"
            className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-nut transition-colors hover:text-choc"
          >
            Shop All →
          </Link>
        </div>

        {products.length === 0 ? (
          <p className="mt-10 font-sans text-sm font-light text-text-mid">
            New arrivals coming soon — explore our collections above.
          </p>
        ) : (
          <BestSellersGrid products={products} />
        )}
      </div>
    </section>
  );
}
