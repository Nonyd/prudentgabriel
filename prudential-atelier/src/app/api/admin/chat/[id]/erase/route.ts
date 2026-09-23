import { NextRequest, NextResponse } from "next/server";
import { ActivityAction, type Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { CASCADE_CONFIRMATION } from "@/lib/cascade-copy";

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
    select: { visitorEmail: true, visitorName: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const where: Prisma.ChatConversationWhereInput = parsed.data.allForVisitor
    ? { visitorEmail: target.visitorEmail }
    : { id };
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
        _count: { select: { messages: true } },
      },
    });
    const snapshot = {
      kind: "ChatErasure",
      visitor: { name: target.visitorName, email: target.visitorEmail },
      reason: parsed.data.reason,
      scope: parsed.data.allForVisitor ? "all conversations for this email" : "one conversation",
      conversations: convos.map((c) => ({
        id: c.id,
        context: c.contextLabel ?? c.contextKind,
        startedAt: c.createdAt.toISOString(),
        lastMessageAt: c.lastMessageAt.toISOString(),
        messages: c._count.messages,
      })),
      actor: { userId: user.id, email: user.email ?? null, role: user.role ?? "", ip: getClientIp(req) },
    };
    await tx.chatConversation.deleteMany({ where: { id: { in: convos.map((c) => c.id) } } });
    const log = await tx.activityLog.create({
      data: {
        userId: user.id,
        userEmail: user.email ?? null,
        userRole: user.role ?? "",
        action: ActivityAction.DELETE,
        module: "chat",
        description: `Erased ${convos.length} chat ${convos.length === 1 ? "conversation" : "conversations"} for ${target.visitorEmail}: ${parsed.data.reason}`,
        recordId: id,
        recordType: "ChatConversation",
        ipAddress: getClientIp(req),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    return { deleted: convos.length, logId: log.id };
  });

  return NextResponse.json({ ok: true, ...result });
}
