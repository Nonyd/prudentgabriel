import { prisma } from "@/lib/prisma";
import { mapProductToListItem } from "@/lib/map-product-list-item";
import type { ProductListItem } from "@/types/product";
import { Hero } from "@/components/home/Hero";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { CollectionsGrid } from "@/components/home/CollectionsGrid";
import { NewArrivals } from "@/components/home/NewArrivals";
import { BespokeStory } from "@/components/home/BespokeStory";
import { BrandStats } from "@/components/home/BrandStats";
import { Testimonials } from "@/components/home/Testimonials";
import { PFABanner } from "@/components/common/PFABanner";
import { NewsletterSection } from "@/components/home/NewsletterSection";

export const revalidate = 3600;

export default async function HomePage() {
  let featured: ProductListItem[] = [];
  let newArrivals: ProductListItem[] = [];

  if (process.env.DATABASE_URL?.trim()) {
    try {
      const [f, n] = await Promise.all([
        prisma.product.findMany({
          where: { isPublished: true, isFeatured: true },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 2 },
            variants: { orderBy: { priceNGN: "asc" } },
            colors: { take: 6 },
            _count: { select: { reviews: true } },
          },
        }),
        prisma.product.findMany({
          where: { isPublished: true, isNewArrival: true },
          orderBy: { createdAt: "desc" },
          take: 4,
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 2 },
            variants: { orderBy: { priceNGN: "asc" } },
            colors: { take: 6 },
            _count: { select: { reviews: true } },
          },
        }),
      ]);
      featured = f.map((p) =>
        mapProductToListItem({
          ...p,
          images: p.images.map((im) => ({ ...im, isPrimary: im.isPrimary })),
          _count: p._count,
        }),
      );
      newArrivals = n.map((p) =>
        mapProductToListItem({
          ...p,
          images: p.images.map((im) => ({ ...im, isPrimary: im.isPrimary })),
          _count: p._count,
        }),
      );
    } catch {
      featured = [];
      newArrivals = [];
    }
  }

  return (
    <>
      <Hero />
      <BrandMarquee />
      <CollectionsGrid />
      <NewArrivals products={newArrivals.length ? newArrivals : featured.slice(0, 4)} />
      <BespokeStory />
      <BrandStats />
      <Testimonials />
      <PFABanner />
      <NewsletterSection />
    </>
  );
}
