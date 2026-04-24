import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { getSetting } from "@/lib/settings";
import { awardReviewPoints } from "@/lib/points";

const bodySchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(80).optional(),
  body: z.string().min(10).max(1000),
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

  const duplicate = await prisma.review.findFirst({
    where: { userId, productId },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 });
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

  const pointsRaw = await getSetting("points_review");
  const pointsAward = Math.max(0, parseInt(pointsRaw ?? "50", 10) || 0);

  let pointsGranted = 0;
  await prisma.$transaction(async (tx) => {
    await tx.review.create({
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

    if (pointsAward > 0) {
      pointsGranted = await awardReviewPoints(userId, pointsAward, productId, tx);
    }
  });

  return NextResponse.json({
    success: true,
    message: "Review submitted for approval",
    pointsAwarded: pointsGranted,
  });
}
