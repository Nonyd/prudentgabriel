import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "bestseller_threshold" },
    });
    const threshold = Number(setting?.value ?? 10);

    const counts = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
    });

    const bestsellerIds = counts
      .filter((c) => (c._sum.quantity ?? 0) >= threshold)
      .map((c) => c.productId);

    await prisma.product.updateMany({ data: { isFeatured: false } });
    if (bestsellerIds.length) {
      await prisma.product.updateMany({
        where: { id: { in: bestsellerIds } },
        data: { isFeatured: true },
      });
    }

    await logActivity({
      action: "UPDATE",
      module: "products",
      description: `Updated bestsellers: ${bestsellerIds.length} products (threshold ${threshold})`,
    });

    return NextResponse.json({ ok: true, updated: bestsellerIds.length, threshold });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CRON_BESTSELLERS",
      message: e instanceof Error ? e.message : "Bestseller update failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
