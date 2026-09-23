import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { CHAT_AWAY_MS } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { getPublicAppUrl } from "@/lib/app-url";

type Params = { params: Promise<{ id: string }> };

/** The thread, marked seen by the house. */
export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  // Everything but the capability token.
  const convo = await prisma.chatConversation.findUnique({
    where: { id },
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      contextKind: true,
      contextPath: true,
      contextLabel: true,
      orderRef: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.chatConversation.update({ where: { id }, data: { staffSeenAt: new Date() } });
  return NextResponse.json({ conversation: convo });
}

const replySchema = z.object({ body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) });

/**
 * A reply from the house. If she has left (her widget has not looked for a
 * couple of minutes) the reply is also emailed, so chat never loses her.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const parsed = replySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 });

  const convo = await prisma.chatConversation.findUnique({ where: { id } });
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = gate.session.user;
  const staffName = user.name?.trim().split(/\s+/)[0] || "The house";
  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: { conversationId: id, author: ChatAuthor.STAFF, staffUserId: user.id, staffName, body: parsed.data.body },
  });
  await prisma.chatConversation.update({
    where: { id },
    data: { lastMessageAt: now, staffSeenAt: now, status: ChatStatus.OPEN, closedAt: null },
  });

  let emailed = false;
  if (now.getTime() - convo.visitorSeenAt.getTime() > CHAT_AWAY_MS) {
    const sent = await sendUsingCatalog({
      key: EMAIL_TEMPLATE_KEYS.CHAT_REPLY,
      to: convo.visitorEmail,
      vars: {
        firstName: convo.visitorName.split(/\s+/)[0] ?? convo.visitorName,
        reply: parsed.data.body,
        staffName,
        link: `${getPublicAppUrl()}${convo.contextPath}`,
      },
      outboxTemplate: "chat-reply",
      idempotencyKey: `chat-reply:${message.id}`,
      relatedType: "ChatConversation",
      relatedId: id,
    });
    if (sent.created) {
      await prisma.chatMessage.update({ where: { id: message.id }, data: { emailedAt: now } });
      emailed = true;
    }
  }
  return NextResponse.json({ id: message.id, emailed }, { status: 201 });
}

const patchSchema = z.object({ status: z.nativeEnum(ChatStatus) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const updated = await prisma.chatConversation
    .update({
      where: { id },
      data: { status: parsed.data.status, closedAt: parsed.data.status === ChatStatus.CLOSED ? new Date() : null },
      select: { id: true, status: true },
    })
    .catch(() => null);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
