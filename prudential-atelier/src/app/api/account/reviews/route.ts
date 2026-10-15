import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PointsType } from "@prisma/client";
import { getLoyaltyRulePoints } from "@/lib/loyalty";
import { awardReviewPoints } from "@/lib/points";
import { notifyConsultationReviewSubmitted, notifyReviewSubmitted } from "@/lib/notifications";
import { reviewableConsultationWhere } from "@/lib/consultation-review";

const productSchema = z.object({
  kind: z.literal("product"),
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(80).optional(),
  body: z.string().min(20).max(500),
});

const consultationSchema = z.object({
  kind: z.literal("consultation"),
  consultationId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().min(20).max(400),
});

const bodySchema = z.discriminatedUnion("kind", [productSchema, consultationSchema]);

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const userName = user?.name ?? "Client";

  if (parsed.data.kind === "product") {
    const { productId, orderId, rating, title, body } = parsed.data;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: "DELIVERED" },
      include: { items: { where: { productId }, take: 1 } },
    });
    if (!order || order.items.length === 0) {
      return NextResponse.json({ error: "Invalid order for this product" }, { status: 403 });
    }

    const pointsAward = await getLoyaltyRulePoints("REVIEW");

    let pointsGranted = 0;
    // Serialize this user's review submissions (advisory lock held until commit)
    // so parallel POSTs cannot each pass the duplicate check and each earn points.
    const review = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`review:${userId}`}))`;
      const duplicate = await tx.review.findFirst({
        where: { userId, productId },
        select: { id: true },
      });
      if (duplicate) return null;

      const r = await tx.review.create({
        data: {
          userId,
          productId,
          rating,
          title: title ?? null,
          body,
          isVerified: true,
          isApproved: false,
          orderId,
        },
      });

      // Points once per (user, product), even if an earlier review was deleted.
      const alreadyAwarded = await tx.pointsTransaction.findFirst({
        where: { userId, type: PointsType.EARNED_REVIEW, description: { contains: `(${productId})` } },
        select: { id: true },
      });
      if (pointsAward > 0 && !alreadyAwarded) {
        pointsGranted = await awardReviewPoints(userId, pointsAward, productId, tx);
      }
      return r;
    });
    if (!review) {
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 });
    }

    void notifyReviewSubmitted({
      reviewId: review.id,
      productName: product.name,
      userName,
      rating,
    });

    return NextResponse.json({
      success: true,
      message: "Review submitted for approval",
      pointsAwarded: pointsGranted,
    });
  }

  const { consultationId, rating, body } = parsed.data;

  const booking = await prisma.consultationBooking.findFirst({
    where: await reviewableConsultationWhere(userId, consultationId),
  });
  if (!booking) {
    return NextResponse.json({ error: "Consultation not found or not completed" }, { status: 403 });
  }

  const review = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`review:${userId}`}))`;
    const duplicate = await tx.review.findFirst({
      where: { userId, consultationId },
      select: { id: true },
    });
    if (duplicate) return null;
    return tx.review.create({
      data: {
        userId,
        consultationId,
        rating,
        body,
        isVerified: true,
        isApproved: false,
      },
    });
  });
  if (!review) {
    return NextResponse.json({ error: "You have already reviewed this consultation" }, { status: 409 });
  }

  void notifyConsultationReviewSubmitted({
    reviewId: review.id,
    userName,
    rating,
  });

  return NextResponse.json({ success: true, message: "Review submitted for approval" });
}
