import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, PointsType } from "@prisma/client";
import { getLoyaltyRulePoints } from "@/lib/loyalty";
import { awardReviewPoints } from "@/lib/points";
import { notifyReviewPending } from "@/lib/notifications";

const bodySchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(80).optional(),
  body: z.string().min(20).max(500),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { productId, rating, title, body } = parsed.data;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, paymentStatus: PaymentStatus.PAID },
    },
    select: { orderId: true },
  });

  if (!orderItem) {
    return NextResponse.json(
      { error: "Only verified buyers can review this product" },
      { status: 403 },
    );
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
        orderId: orderItem.orderId,
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

  void notifyReviewPending(review, product.name);

  return NextResponse.json({
    success: true,
    message: "Review submitted for approval",
    pointsAwarded: pointsGranted,
  });
}
