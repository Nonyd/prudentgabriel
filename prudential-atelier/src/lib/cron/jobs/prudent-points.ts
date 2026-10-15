import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { expireOverduePoints } from "@/lib/points";
import { sendPointsExpiryEmail } from "@/lib/email";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function run(ctx: CronJobContext): Promise<JobResult> {
  const now = ctx.now;
  let processed = 0;
  let failed = 0;

  let expiredThisPass = 0;
  do {
    if (ctx.isBudgetExhausted()) {
      return { processed, failed, hasMore: true };
    }
    expiredThisPass = await expireOverduePoints(prisma, now);
    processed += expiredThisPass;
  } while (expiredThisPass > 0);

  const windowEnd = new Date(now.getTime() + THIRTY_DAYS_MS);
  const soon = await prisma.pointsTransaction.findMany({
    where: {
      remaining: { gt: 0 },
      expiresAt: { gt: now, lte: windowEnd },
    },
    select: { userId: true, remaining: true, expiresAt: true },
  });

  const byUser = new Map<string, { points: number; earliest: Date }>();
  for (const row of soon) {
    if (!row.expiresAt) continue;
    const cur = byUser.get(row.userId);
    if (!cur) {
      byUser.set(row.userId, { points: row.remaining, earliest: row.expiresAt });
    } else {
      cur.points += row.remaining;
      if (row.expiresAt < cur.earliest) cur.earliest = row.expiresAt;
    }
  }

  for (const [userId, batch] of Array.from(byUser.entries())) {
    if (ctx.isBudgetExhausted()) {
      return { processed, failed, hasMore: true };
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (!user?.email) continue;
      const batchKey = batch.earliest.toISOString().slice(0, 10);
      const firstName = user.name?.split(" ")[0] ?? "there";
      await sendPointsExpiryEmail({
        to: user.email,
        firstName,
        points: batch.points,
        expiryLabel: batch.earliest.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        userId,
        batchKey,
      });
      processed += 1;
    } catch (e) {
      console.warn("[prudent-points] expiry mail", userId, e);
      failed += 1;
    }
  }

  // Birthday points now go out with the birthday wish (jobs/birthday-wishes.ts).
  return { processed, failed };
}
