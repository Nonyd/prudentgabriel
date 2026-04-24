import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";
import { CompleteTheLook } from "@/components/product/CompleteTheLook";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCardSkeleton } from "@/components/common/ProductCardSkeleton";
import { RecentlyViewed } from "@/components/common/RecentlyViewed";
import { ViewTracker } from "@/components/product/ViewTracker";
import type { ProductListItem } from "@/types/product";
import type { ReviewItem } from "@/components/product/ReviewsSection";
import { mapProductToListItem } from "@/lib/map-product-list-item";

const ReviewsSection = dynamic(() => import("@/components/product/ReviewsSection").then((m) => ({ default: m.ReviewsSection })), {
  loading: () => <Skeleton className="h-64 w-full rounded-sm" />,
});

const RelatedProducts = dynamic(() => import("@/components/product/RelatedProducts").then((m) => ({ default: m.RelatedProducts })), {
  loading: () => (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
      {[0, 1, 2, 3].map((i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  ),
});

export const revalidate = 60;

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL?.trim()) return [];
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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      description: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  });
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: product.images[0]?.url
      ? { images: [{ url: product.images[0].url, alt: product.name }] }
      : undefined,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
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
  });

  if (!product || (!product.isPublished && !isAdmin)) notFound();

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

  let canWriteReview = false;
  if (session?.user?.id) {
    const order = await prisma.order.findFirst({
      where: {
        userId: session.user.id,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        items: { some: { productId: product.id } },
      },
    });
    canWriteReview = Boolean(order);
  }

  const relatedRaw = await prisma.product.findMany({
    where: {
      category: product.category,
      isPublished: true,
      NOT: { id: product.id },
    },
    take: 4,
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
          canWriteReview={canWriteReview}
        />
        <CompleteTheLook products={bundleProducts} />
        <RelatedProducts products={relatedProducts} />
        <RecentlyViewed />
      </div>
    </>
  );
}
