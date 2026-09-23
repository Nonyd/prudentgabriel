import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { getChatRetentionDays } from "@/lib/chat";

/**
 * BA5: conversations are personal data. Delete any whose last message is older
 * than the house's retention period (messages cascade). With no period set,
 * chat cannot be on, and this deletes nothing — it never guesses one.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const days = await getChatRetentionDays();
  if (days == null) return { processed: 0, failed: 0, hasMore: false, detail: { skipped: "no retention period set" } };
  const cutoff = new Date(ctx.now.getTime() - days * 24 * 60 * 60 * 1000);
  const old = await prisma.chatConversation.findMany({
    where: { lastMessageAt: { lt: cutoff } },
    select: { id: true },
    take: ctx.batchLimit,
  });
  const { count } = await prisma.chatConversation.deleteMany({ where: { id: { in: old.map((c) => c.id) } } });
  return { processed: count, failed: 0, hasMore: old.length >= ctx.batchLimit, detail: { retentionDays: days } };
}
