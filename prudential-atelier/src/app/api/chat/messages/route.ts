import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { findChatByToken, isChatOpen } from "@/lib/chat";
import { CHAT_COOKIE, CHAT_MESSAGE_MAX } from "@/lib/chat-shared";

const bodySchema = z.object({ body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) });

/** BA5: the visitor adds a message to her own conversation (cookie). */
export async function POST(req: NextRequest) {
  if (!(await isChatOpen())) {
    return NextResponse.json({ error: "Chat is not open at the moment." }, { status: 403 });
  }
  const limited = await rateLimitOr429(req, "chat-message", 60, 15 * 60 * 1000);
  if (limited) return limited;

  const convo = await findChatByToken(req.cookies.get(CHAT_COOKIE)?.value);
  if (!convo) return NextResponse.json({ error: "No conversation" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 });

  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: { conversationId: convo.id, author: ChatAuthor.VISITOR, body: parsed.data.body },
  });
  // Writing again reopens a closed conversation.
  await prisma.chatConversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: now, visitorSeenAt: now, status: ChatStatus.OPEN, closedAt: null },
  });
  return NextResponse.json({ id: message.id }, { status: 201 });
}
