import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { editRefusal, getChatStaffing } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { threadChanged } from "@/lib/chat-bus";

const bodySchema = z.object({ body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) });

/**
 * BF8: the house corrects its own line — the same rule as the visitor's, in
 * the same direction: only your own line, within the window, never once she
 * has replied (409). The original stays; the inbox shows both.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const gate = await requireAdminApi("chat");
  if (!gate.ok) return gate.response;
  const { id, messageId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 });

  const message = await prisma.chatMessage.findFirst({ where: { id: messageId, conversationId: id, internal: false } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const later = await prisma.chatMessage.findMany({
    where: { conversationId: id, internal: false, createdAt: { gt: message.createdAt } },
    select: { author: true },
  });
  const refusal = editRefusal({
    message,
    editor: { author: "STAFF", userId: gate.session.user.id! },
    laterAuthors: later.map((m) => m.author),
    windowSec: (await getChatStaffing()).editWindowSec,
  });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });

  const revision = await prisma.chatMessageRevision.create({ data: { messageId, body: parsed.data.body } });
  threadChanged(id, "edit");
  return NextResponse.json({ id: messageId, editedAt: revision.createdAt.toISOString() });
}
