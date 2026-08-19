import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { sendAbandonedCartEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const cutoff = new Date(ctx.now.getTime() - ABANDONED_AFTER_MS);
  const staleUserRows = await prisma.cartItem.findMany({
    where: { updatedAt: { lte: cutoff } },
    distinct: ["userId"],
    select: { userId: true },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  let stoppedForBudget = false;
  const checkoutUrl = `${getPublicAppUrl().replace(/\/+$/, "")}/checkout`;

  for (const row of staleUserRows) {
    if (ctx.isBudgetExhausted()) {
      stoppedForBudget = true;
      break;
    }
    try {
      const items = await prisma.cartItem.findMany({
        where: { userId: row.userId },
        include: {
          product: { select: { name: true } },
          user: { select: { email: true, name: true } },
        },
        orderBy: { id: "asc" },
      });
      if (items.length === 0) continue;

      const lastActivity = items.reduce(
        (max, i) => (i.updatedAt > max ? i.updatedAt : max),
        items[0]!.updatedAt,
      );
      if (lastActivity > cutoff) continue;

      const user = items[0]!.user;
      if (!user.email) continue;

      const laterOrder = await prisma.order.findFirst({
        where: { userId: row.userId, createdAt: { gte: lastActivity } },
        select: { id: true },
      });
      if (laterOrder) continue;

      const fingerprint = items.map((i) => i.id).join(",");
      const firstName = (user.name ?? "there").split(/\s+/)[0] || "there";
      const sent = await sendAbandonedCartEmail({
        to: user.email,
        firstName,
        lines: items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
        checkoutUrl,
        idempotencyKey: `abandoned-cart:${row.userId}:${fingerprint}`,
        userId: row.userId,
      });
      if (sent.created) processed += 1;
    } catch (e) {
      console.warn("[abandoned-cart]", row.userId, e);
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    hasMore: stoppedForBudget || staleUserRows.length >= ctx.batchLimit,
    detail: { candidates: staleUserRows.length },
  };
}
