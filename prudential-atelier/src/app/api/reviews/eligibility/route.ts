import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const [paidItem, existingReview] = await Promise.all([
    prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId: session.user.id, paymentStatus: PaymentStatus.PAID },
      },
      select: { orderId: true },
    }),
    prisma.review.findFirst({
      where: { userId: session.user.id, productId },
      select: { id: true },
    }),
  ]);

  const hasReviewed = Boolean(existingReview);
  const isVerifiedBuyer = Boolean(paidItem);
  const canReview = isVerifiedBuyer && !hasReviewed;

  let reason: string | undefined;
  if (!isVerifiedBuyer) {
    reason = "Only verified buyers can review this product.";
  } else if (hasReviewed) {
    reason = "You have already reviewed this product.";
  }

  return NextResponse.json({
    canReview,
    hasReviewed,
    isVerifiedBuyer,
    reason,
    orderId: paidItem?.orderId ?? null,
  });
}
