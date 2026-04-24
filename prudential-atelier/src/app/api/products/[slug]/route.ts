import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const session = await auth();
    const isAdmin =
      session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

    const product = await prisma.product.findUnique({
      where: { slug: params.slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { priceNGN: "asc" } },
        colors: true,
        reviews: {
          where: { isApproved: true },
          include: {
            user: { select: { name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
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

    if (!product || (!product.isPublished && !isAdmin)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const approvedReviews = product.reviews;
    const averageRating =
      approvedReviews.length === 0
        ? 0
        : approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedReviews.length;
    const reviewCount = approvedReviews.length;

    return NextResponse.json(
      {
        product: {
          ...product,
          reviews: approvedReviews.map((r) => ({
            ...r,
            user: {
              ...r.user,
              firstName: r.user.name?.split(/\s+/)[0] ?? null,
            },
          })),
        },
        averageRating,
        reviewCount,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
}
