import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { sendProductReviewRequestEmail } from "@/lib/email";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

    const eligibleOrders = await prisma.order.findMany({
      where: {
        status: "DELIVERED",
        reviewRequestSent: false,
        isBespoke: false,
        userId: { not: null },
        updatedAt: { lte: cutoff },
      },
      include: {
        user: { select: { email: true, name: true } },
        items: {
          take: 1,
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });

    let sent = 0;
    for (const order of eligibleOrders) {
      if (!order.user?.email) continue;
      const item = order.items[0];
      if (!item?.product) continue;

      const firstName = (order.user.name ?? "there").split(/\s+/)[0] ?? "there";

      await sendProductReviewRequestEmail({
        to: order.user.email,
        firstName,
        productName: item.product.name,
        productId: item.product.id,
        orderId: order.id,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { reviewRequestSent: true },
      });

      sent += 1;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_REVIEW_REQUESTS",
      message: e instanceof Error ? e.message : "Review request cron failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
