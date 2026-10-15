import { NextRequest, NextResponse } from "next/server";
import { ActivityAction, type Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { CASCADE_CONFIRMATION } from "@/lib/cascade-copy";
import { deleteOrphanedChatFiles } from "@/lib/chat-files";
import { publishInbox } from "@/lib/chat-bus";

const bodySchema = z.object({
  /** Typed confirmation, as Slice AC's cascade delete uses. */
  confirmation: z.string(),
  /** Erase every conversation with this visitor's email, not just this one. */
  allForVisitor: z.boolean().default(false),
  /** Why — usually "Erasure request under the NDPA". Recorded. */
  reason: z.string().trim().min(3).max(500),
});

/**
 * BA5 — erasure. Conversations are kept indefinitely (the house's decision), so
 * a request to be forgotten needs a manual delete: SUPER_ADMIN only (real, not
 * impersonating), typed confirmation, and an ActivityLog row saying what was
 * deleted and for whom — in the same transaction, the shape Slice AC uses.
 * The log keeps who and how much, never the words: keeping them would undo
 * the erasure.
 *
 * BF7: the files go too. Their keys are read before the rows are deleted and
 * the files are removed from disk afterwards; a removal request that left her
 * uploads on disk would make the privacy policy untrue.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A reason and the confirmation are required" }, { status: 400 });
  if (parsed.data.confirmation !== CASCADE_CONFIRMATION) {
    return NextResponse.json({ error: `Type ${CASCADE_CONFIRMATION} to erase` }, { status: 400 });
  }

  const target = await prisma.chatConversation.findUnique({
    where: { id },
    select: { visitorEmail: true, visitorPhone: true, visitorName: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // "Every conversation for this person": her email, or her phone when she gave only that.
  const where: Prisma.ChatConversationWhereInput =
    parsed.data.allForVisitor && (target.visitorEmail || target.visitorPhone)
      ? target.visitorEmail
        ? { visitorEmail: target.visitorEmail }
        : { visitorPhone: target.visitorPhone }
      : { id };
  const who = target.visitorEmail ?? target.visitorPhone ?? target.visitorName;
  const user = gate.session.user;

  const result = await prisma.$transaction(async (tx) => {
    const convos = await tx.chatConversation.findMany({
      where,
      select: {
        id: true,
        visitorName: true,
        contextKind: true,
        contextLabel: true,
        createdAt: true,
        lastMessageAt: true,
        _count: { select: { messages: true, attachments: true } },
      },
    });
    const snapshot = {
      kind: "ChatErasure",
      visitor: { name: target.visitorName, email: target.visitorEmail, phone: target.visitorPhone },
      reason: parsed.data.reason,
      scope: parsed.data.allForVisitor ? "all conversations for this email" : "one conversation",
      conversations: convos.map((c) => ({
        id: c.id,
        context: c.contextLabel ?? c.contextKind,
        startedAt: c.createdAt.toISOString(),
        lastMessageAt: c.lastMessageAt.toISOString(),
        messages: c._count.messages,
        files: c._count.attachments,
      })),
      actor: { userId: user.id, email: user.email ?? null, role: user.role ?? "", ip: getClientIp(req) },
    };
    // Read in the same transaction, so a file sent a moment ago is not left behind.
    const files = await tx.chatAttachment.findMany({
      where: { conversationId: { in: convos.map((c) => c.id) } },
      select: { storageKey: true },
    });
    await tx.chatConversation.deleteMany({ where: { id: { in: convos.map((c) => c.id) } } });
    const log = await tx.activityLog.create({
      data: {
        userId: user.id,
        userEmail: user.email ?? null,
        userRole: user.role ?? "",
        action: ActivityAction.DELETE,
        module: "chat",
        description: `Erased ${convos.length} chat ${convos.length === 1 ? "conversation" : "conversations"} for ${who}: ${parsed.data.reason}`,
        recordId: id,
        recordType: "ChatConversation",
        ipAddress: getClientIp(req),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    return { deleted: convos.length, logId: log.id, fileKeys: files.map((f) => f.storageKey) };
  });

  // After the rows are gone, the files: removed from disk unless another conversation shares one.
  const { fileKeys, ...summary } = result;
  const removed = await deleteOrphanedChatFiles(fileKeys);
  publishInbox();
  return NextResponse.json({ ok: true, ...summary, filesDeleted: removed.length });
}
