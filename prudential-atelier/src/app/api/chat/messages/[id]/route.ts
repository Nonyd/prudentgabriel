import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { editRefusal, getChatAvailability, getChatStaffing } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { threadChanged } from "@/lib/chat-bus";

const bodySchema = z.object({ body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) });

/**
 * BF8: she corrects her own line within the window. The original is kept (a
 * revision is appended, never written over) and the line shows as edited.
 * Refused (409) once the house has replied, even inside the window.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getChatAvailability()).enabled) return NextResponse.json({ error: "Chat is not open at the moment." }, { status: 403 });
  const limited = await rateLimitOr429(req, "chat-edit", 30, 15 * 60 * 1000);
  if (limited) return limited;
  const { id } = await params;
  const { conversation } = await resolveChatVisitor(req);
  if (!conversation) return NextResponse.json({ error: "No conversation" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 });

  const message = await prisma.chatMessage.findFirst({ where: { id, conversationId: conversation.id, internal: false } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const later = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id, internal: false, createdAt: { gt: message.createdAt } },
    select: { author: true },
  });
  const refusal = editRefusal({
    message,
    editor: { author: "VISITOR" },
    laterAuthors: later.map((m) => m.author),
    windowSec: (await getChatStaffing()).editWindowSec,
  });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });

  const revision = await prisma.chatMessageRevision.create({ data: { messageId: message.id, body: parsed.data.body } });
  threadChanged(conversation.id, "edit");
  return NextResponse.json({ id: message.id, editedAt: revision.createdAt.toISOString() });
}
