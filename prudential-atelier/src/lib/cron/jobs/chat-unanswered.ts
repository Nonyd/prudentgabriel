import { ChatAuthor, ChatStatus } from "@prisma/client";
import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { closedLine, getChatAvailability, getChatStaffing, nobodyFreeLine } from "@/lib/chat";
import { notifyChat } from "@/lib/chat-notify";
import { threadChanged } from "@/lib/chat-bus";

/**
 * Slice BF6 — when nobody comes. Hours say someone is there; one person on a
 * shop floor means sometimes nobody is. An open chat left unanswered is worse
 * than one that is honestly closed, so every minute:
 *
 * 1. Unanswered past the first period (a setting): tell the recipients again.
 *    This is also BF9's only re-notification — per conversation, not per message.
 * 2. Still unanswered past the second period (a setting): tell her, honestly —
 *    nobody is free, the house will reply by email (or phone). From then on the
 *    conversation behaves like an out-of-hours one.
 * 3. The house closed while she waited: tell her it is closed, and when it opens.
 *
 * Each step is guarded on the stage it moves from, so two runs never repeat one.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const staffing = await getChatStaffing();
  const a = await getChatAvailability(ctx.now, staffing);
  if (!a.enabled) return { processed: 0, failed: 0, hasMore: false, detail: { skipped: "chat off" } };

  const renotifyBefore = new Date(ctx.now.getTime() - staffing.renotifyMin * 60_000);
  const giveUpBefore = new Date(ctx.now.getTime() - staffing.giveUpMin * 60_000);
  const waiting = await prisma.chatConversation.findMany({
    where: {
      status: ChatStatus.OPEN,
      unansweredStage: { lt: 2 },
      awaitingSince: { not: null, lt: a.live ? renotifyBefore : ctx.now },
    },
    orderBy: { awaitingSince: "asc" },
    take: ctx.batchLimit,
    select: { id: true, visitorName: true, visitorEmail: true, visitorPhone: true, awaitingSince: true, unansweredStage: true },
  });

  let renotified = 0;
  let toldNobody = 0;
  let toldClosed = 0;
  for (const c of waiting) {
    const contact = { email: c.visitorEmail, phone: c.visitorPhone };
    const giveUp = !a.live || c.awaitingSince! < giveUpBefore;
    if (giveUp) {
      const moved = await prisma.chatConversation.updateMany({
        where: { id: c.id, unansweredStage: c.unansweredStage, awaitingSince: { not: null } },
        data: { unansweredStage: 2, ...(a.live ? {} : { offHoursAt: ctx.now }) },
      });
      if (!moved.count) continue;
      await prisma.chatMessage.create({
        data: { conversationId: c.id, author: ChatAuthor.SYSTEM, body: a.live ? nobodyFreeLine(contact) : closedLine(a.opensLabel, contact) },
      });
      threadChanged(c.id, "unanswered");
      if (a.live) toldNobody += 1;
      else toldClosed += 1;
      continue;
    }
    if (c.unansweredStage === 0) {
      const moved = await prisma.chatConversation.updateMany({
        where: { id: c.id, unansweredStage: 0, awaitingSince: { not: null } },
        data: { unansweredStage: 1 },
      });
      if (!moved.count) continue;
      const mins = Math.round((ctx.now.getTime() - c.awaitingSince!.getTime()) / 60_000);
      await notifyChat({
        conversationId: c.id,
        reason: "unanswered",
        staffing,
        title: `Chat still waiting — ${c.visitorName}`,
        message: `${c.visitorName} has been waiting ${mins} minute${mins === 1 ? "" : "s"} for a reply.`,
      });
      threadChanged(c.id, "unanswered");
      renotified += 1;
    }
  }
  return {
    processed: renotified + toldNobody + toldClosed,
    failed: 0,
    hasMore: waiting.length >= ctx.batchLimit,
    detail: { renotified, toldNobody, toldClosed, renotifyMin: staffing.renotifyMin, giveUpMin: staffing.giveUpMin },
  };
}
