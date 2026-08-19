import nextDynamic from "next/dynamic";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";
import { CompleteTheLook } from "@/components/product/CompleteTheLook";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCardSkeleton } from "@/components/common/ProductCardSkeleton";
import { RecentlyViewed } from "@/components/common/RecentlyViewed";
import { ViewTracker } from "@/components/product/ViewTracker";
import type { ProductListItem } from "@/types/product";
import type { ReviewItem } from "@/components/product/ReviewsSection";
import { mapProductToListItem } from "@/lib/map-product-list-item";


const ReviewsSection = nextDynamic(() => import("@/components/product/ReviewsSection").then((m) => ({ default: m.ReviewsSection })), {
  loading: () => <Skeleton className="h-64 w-full rounded-sm" />,
});

const RelatedProducts = nextDynamic(() => import("@/components/product/RelatedProducts").then((m) => ({ default: m.RelatedProducts })), {
  loading: () => (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
      {[0, 1, 2, 3].map((i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  ),
});

export const revalidate = 300;

export async function generateStaticParams() {
  if (process.env.SKIP_DB_BUILD === "1" || !process.env.DATABASE_URL?.trim()) return [];
  try {
    const rows = await prisma.product.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { slug: true },
    });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

const getPublishedProduct = cache(async (slug: string) =>
  prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { priceNGN: "asc" } },
      colors: true,
      reviews: {
        where: { isApproved: true },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
      },
      bundleItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          targetProduct: {
            include: {
              images: { orderBy: { sortOrder: "asc" }, take: 2 },
              variants: { orderBy: { priceNGN: "asc" } },
              colors: { take: 6 },
              _count: { select: { reviews: true } },
            },
          },
        },
      },
    },
  }),
);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getPublishedProduct(params.slug);
  if (!product?.isPublished) return { title: "Product" };
  const primary = product.images.find((im) => im.isPrimary) ?? product.images[0];
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: primary?.url ? { images: [{ url: primary.url, alt: product.name }] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getPublishedProduct(params.slug);

  if (!product || !product.isPublished) notFound();

  const approved = product.reviews;
  const averageRating =
    approved.length === 0 ? 0 : approved.reduce((s, r) => s + r.rating, 0) / approved.length;
  const reviewCount = approved.length;

  const reviews: ReviewItem[] = approved.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isVerified: r.isVerified,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
  }));

  const relatedRaw = await prisma.product.findMany({
    where: {
      category: product.category,
      id: { not: product.id },
      isPublished: true,
    },
    take: 4,
    orderBy: { orderCount: "desc" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 2 },
      variants: { orderBy: { priceNGN: "asc" } },
      colors: { take: 6 },
      _count: { select: { reviews: true } },
    },
  });

  const bundleProducts: ProductListItem[] = product.bundleItems.map((b) =>
    mapProductToListItem({
      ...b.targetProduct,
      images: b.targetProduct.images.map((im) => ({
        ...im,
        isPrimary: im.isPrimary,
      })),
      _count: b.targetProduct._count,
    }),
  );

  const relatedProducts: ProductListItem[] = relatedRaw.map((p) =>
    mapProductToListItem({
      ...p,
      images: p.images.map((im) => ({ ...im, isPrimary: im.isPrimary })),
      _count: p._count,
    }),
  );

  return (
    <>
      <ViewTracker productId={product.id} />
      <ProductDetailClient
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          details: product.details,
          category: product.category,
          type: product.type,
          isOnSale: product.isOnSale,
          saleEndsAt: product.saleEndsAt?.toISOString() ?? null,
          isBespokeAvail: product.isBespokeAvail,
          lowStockAt: product.lowStockAt,
          basePriceNGN: product.basePriceNGN,
          isNewArrival: product.isNewArrival,
          isFeatured: product.isFeatured,
          tags: product.tags,
          images: product.images,
          variants: product.variants,
          colors: product.colors,
        }}
        averageRating={averageRating}
        reviewCount={reviewCount}
      />
      <div className="mx-auto max-w-site px-4">
        <ReviewsSection
          reviews={reviews}
          averageRating={averageRating}
          reviewCount={reviewCount}
          productId={product.id}
          productSlug={product.slug}
        />
        <CompleteTheLook products={bundleProducts} />
        <RelatedProducts products={relatedProducts} />
        <RecentlyViewed />
      </div>
    </>
  );
}
