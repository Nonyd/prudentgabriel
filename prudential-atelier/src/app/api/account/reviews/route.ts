import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { awardReviewPoints } from "@/lib/points";
import { notifyConsultationReviewSubmitted, notifyReviewSubmitted } from "@/lib/notifications";

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

    const duplicate = await prisma.review.findFirst({
      where: { userId, productId },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 });
    }

    const pointsRaw = await getSetting("points_review");
    const pointsAward = Math.max(0, parseInt(pointsRaw ?? "50", 10) || 0);

    let pointsGranted = 0;
    const review = await prisma.$transaction(async (tx) => {
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

      if (pointsAward > 0) {
        pointsGranted = await awardReviewPoints(userId, pointsAward, productId, tx);
      }
      return r;
    });

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
    where: { id: consultationId, userId, status: "COMPLETED" },
  });
  if (!booking) {
    return NextResponse.json({ error: "Consultation not found or not completed" }, { status: 403 });
  }

  const duplicate = await prisma.review.findFirst({
    where: { userId, consultationId },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "You have already reviewed this consultation" }, { status: 409 });
  }

  const review = await prisma.review.create({
    data: {
      userId,
      consultationId,
      rating,
      body,
      isVerified: true,
      isApproved: false,
    },
  });

  void notifyConsultationReviewSubmitted({
    reviewId: review.id,
    userName,
    rating,
  });

  return NextResponse.json({ success: true, message: "Review submitted for approval" });
}
