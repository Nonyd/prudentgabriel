import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { getSetting } from "@/lib/settings";
import { awardReviewPoints } from "@/lib/points";
import { notifyReviewSubmitted } from "@/lib/notifications";

const postSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(80).optional(),
  body: z.string().min(20).max(500),
});

async function resolveProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const product = await resolveProduct(slug);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const reviews = await prisma.review.findMany({
    where: { productId: product.id, isApproved: true },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      isVerified: r.isVerified,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
    averageRating: avgRating,
    reviewCount: reviews.length,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const product = await resolveProduct(slug);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { rating, title, body } = parsed.data;

  const duplicate = await prisma.review.findFirst({
    where: { userId, productId: product.id },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 });
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId: product.id,
      order: { userId, paymentStatus: PaymentStatus.PAID },
    },
    select: { orderId: true },
  });

  if (!orderItem) {
    return NextResponse.json({ error: "Purchase this piece to leave a review" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const pointsRaw = await getSetting("points_review");
  const pointsAward = Math.max(0, parseInt(pointsRaw ?? "50", 10) || 0);

  let pointsGranted = 0;
  const review = await prisma.$transaction(async (tx) => {
    const r = await tx.review.create({
      data: {
        userId,
        productId: product.id,
        rating,
        title: title ?? null,
        body,
        isVerified: true,
        isApproved: false,
        orderId: orderItem.orderId,
      },
    });

    if (pointsAward > 0) {
      pointsGranted = await awardReviewPoints(userId, pointsAward, product.id, tx);
    }
    return r;
  });

  notifyReviewSubmitted({
    reviewId: review.id,
    productName: product.name,
    userName: user?.name ?? "A client",
    rating,
  });

  return NextResponse.json({
    success: true,
    message: "Thank you! Your review will appear after approval.",
    pointsAwarded: pointsGranted,
  });
}
