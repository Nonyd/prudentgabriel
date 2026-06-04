import { prisma } from "@/lib/prisma";
import { BestSellersGrid } from "./BestSellersGrid";

export async function BestSellers() {
  let products: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
  }[] = [];

  try {
    const featured = await prisma.product.findMany({
      where: { isPublished: true, isFeatured: true },
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });

    const list =
      featured.length > 0
        ? featured
        : await prisma.product.findMany({
            where: { isPublished: true },
            take: 3,
            orderBy: { createdAt: "desc" },
            include: { images: { where: { isPrimary: true }, take: 1 } },
          });

    products = list.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.priceNGN,
      images: p.images[0]?.url ? [p.images[0].url] : [],
    }));
  } catch {
    products = [];
  }

  return (
    <section className="bg-choc px-6 py-20 text-cream lg:px-10">
      <div className="mx-auto max-w-site">
        <p className="eyebrow text-lightbr">Curated</p>
        <h2 className="mt-3 font-serif text-[clamp(2rem,3vw,2.625rem)] font-medium">Best Sellers</h2>

        {products.length === 0 ? (
          <p className="mt-10 font-sans text-sm font-light text-cream/70">
            New arrivals coming soon — explore our collections above.
          </p>
        ) : (
          <BestSellersGrid products={products} />
        )}
      </div>
    </section>
  );
}
