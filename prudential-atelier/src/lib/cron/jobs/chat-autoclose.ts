import { ChatStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";

/** Thirty days of silence is a finished conversation. */
export const CHAT_AUTOCLOSE_DAYS = 30;

/**
 * Conversations are kept indefinitely, so nothing leaves the open list unless
 * someone closes it. This closes an OPEN conversation after 30 quiet days.
 * Closing is reversible: her next message reopens it, and an admin can reopen
 * it from the Closed tab. Nothing is deleted.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const cutoff = new Date(ctx.now.getTime() - CHAT_AUTOCLOSE_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.chatConversation.updateMany({
    where: { status: ChatStatus.OPEN, lastMessageAt: { lt: cutoff } },
    data: { status: ChatStatus.CLOSED, closedAt: ctx.now },
  });
  return { processed: count, failed: 0, hasMore: false, detail: { quietDays: CHAT_AUTOCLOSE_DAYS } };
}
