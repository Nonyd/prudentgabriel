import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { getChatRetention } from "@/lib/chat";
import { chatFileKeys, deleteOrphanedChatFiles } from "@/lib/chat-files";

/**
 * BA5: conversations are personal data. Delete any whose last message is older
 * than the house's retention period (messages cascade). While the house keeps
 * conversations indefinitely (its decision) or has not decided, it deletes
 * nothing and never guesses a period. Kept so a period can be set later.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const retention = await getChatRetention();
  if (retention.kind !== "days") {
    return { processed: 0, failed: 0, hasMore: false, detail: { skipped: retention.kind === "keep" ? "kept indefinitely" : "no decision" } };
  }
  const days = retention.days;
  const cutoff = new Date(ctx.now.getTime() - days * 24 * 60 * 60 * 1000);
  const old = await prisma.chatConversation.findMany({
    where: { lastMessageAt: { lt: cutoff } },
    select: { id: true },
    take: ctx.batchLimit,
  });
  // BF7: their files go with them, from disk.
  const keys = await chatFileKeys(old.map((c) => c.id));
  const { count } = await prisma.chatConversation.deleteMany({ where: { id: { in: old.map((c) => c.id) } } });
  const removed = await deleteOrphanedChatFiles(keys);
  return {
    processed: count,
    failed: 0,
    hasMore: old.length >= ctx.batchLimit,
    detail: { retentionDays: days, filesDeleted: removed.length },
  };
}
