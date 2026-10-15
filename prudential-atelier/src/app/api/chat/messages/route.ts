import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { getChatAvailability } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { threadChanged } from "@/lib/chat-bus";

const bodySchema = z.object({ body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) });

/**
 * BA5: the visitor adds a message to her own conversation — live only.
 * BF2: outside the schedule a live message is refused (409, with when it opens
 * next) and the widget turns into the out-of-hours form, which leaves the
 * message through POST /api/chat (202) instead. Nothing she writes is lost.
 */
export async function POST(req: NextRequest) {
  const a = await getChatAvailability();
  if (!a.enabled) {
    return NextResponse.json({ error: "Chat is not open at the moment." }, { status: 403 });
  }
  if (!a.live) {
    return NextResponse.json(
      {
        error: a.opensLabel ? `Chat is closed. We open again ${a.opensLabel} (Lagos time).` : "Chat is closed right now.",
        offline: true,
        opensAt: a.opensAt?.toISOString() ?? null,
        opensLabel: a.opensLabel,
      },
      { status: 409 },
    );
  }
  const limited = await rateLimitOr429(req, "chat-message", 60, 15 * 60 * 1000);
  if (limited) return limited;

  const { conversation: convo } = await resolveChatVisitor(req);
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
  // Writing again reopens a closed conversation. A fresh wait starts BF6's clock.
  await prisma.chatConversation.update({
    where: { id: convo.id },
    data: {
      lastMessageAt: now,
      visitorSeenAt: now,
      status: ChatStatus.OPEN,
      closedAt: null,
      awaitingSince: convo.awaitingSince ?? now,
      ...(convo.awaitingSince ? {} : { unansweredStage: 0, offHoursAt: null }),
    },
  });
  threadChanged(convo.id, "message");
  return NextResponse.json({ id: message.id }, { status: 201 });
}
