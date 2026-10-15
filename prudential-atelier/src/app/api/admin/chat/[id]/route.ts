import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { z } from "zod";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { CHAT_AWAY_MS, getChatStaffing, staffChatName } from "@/lib/chat";
import { CHAT_MESSAGE_MAX } from "@/lib/chat-shared";
import { activeHolder, claimConversation } from "@/lib/chat-claim";
import { threadChanged, visitorConnected } from "@/lib/chat-bus";
import { sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { getPublicAppUrl } from "@/lib/app-url";

type Params = { params: Promise<{ id: string }> };

/**
 * The thread, marked seen by the house. The house always sees everything:
 * claiming controls who replies, never who reads. Edits show the original
 * and every correction (BF8); takeovers show as internal lines (BF5).
 */
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
      visitorPhone: true,
      userId: true,
      contextKind: true,
      contextPath: true,
      contextLabel: true,
      orderRef: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      handlerId: true,
      handlerName: true,
      handlerActiveAt: true,
      awaitingSince: true,
      unansweredStage: true,
      offHoursAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          revisions: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true } },
          attachments: { select: { id: true, mime: true, originalName: true, bytes: true } },
        },
      },
    },
  });
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.chatConversation.update({ where: { id }, data: { staffSeenAt: new Date() } });

  const { claimIdleMin } = await getChatStaffing();
  const { handlerId, handlerName, handlerActiveAt, ...rest } = convo;
  // BF4: one person, one history — her other conversations (same account, or same email/phone).
  const related = await prisma.chatConversation.findMany({
    where: {
      id: { not: id },
      OR: [
        ...(convo.userId ? [{ userId: convo.userId }] : []),
        ...(convo.visitorEmail ? [{ visitorEmail: convo.visitorEmail }] : []),
        ...(convo.visitorPhone ? [{ visitorPhone: convo.visitorPhone }] : []),
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    select: { id: true, contextLabel: true, contextPath: true, status: true, lastMessageAt: true },
  });
  return NextResponse.json({
    conversation: {
      ...rest,
      holder: activeHolder({ handlerId, handlerName, handlerActiveAt }, claimIdleMin),
      visitorOnline: visitorConnected(id),
      related: convo.userId || convo.visitorEmail || convo.visitorPhone ? related : [],
      messages: rest.messages.map((m) => ({
        id: m.id,
        author: m.author,
        staffName: m.staffName,
        staffUserId: m.staffUserId,
        internal: m.internal,
        // The original is what was sent; the latest edit is what she now reads.
        original: m.body,
        body: m.revisions.length ? m.revisions[m.revisions.length - 1].body : m.body,
        revisions: m.revisions,
        attachments: m.attachments.map((a) => ({ id: a.id, mime: a.mime, name: a.originalName, bytes: a.bytes })),
        emailedAt: m.emailedAt,
        createdAt: m.createdAt,
      })),
    },
    me: gate.session.user.id,
  });
}

const replySchema = z.object({ body: z.string().trim().min(1).max(CHAT_MESSAGE_MAX) });

/**
 * A reply from the house. Replying claims the conversation (BF5); if someone
 * else is actively handling it, the reply is refused (409) until she takes it
 * over deliberately. If the visitor has left (her panel is closed and has not
 * looked for a couple of minutes) the reply is also emailed.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const parsed = replySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is empty or too long" }, { status: 400 });

  const user = gate.session.user;
  const claim = await claimConversation(id, { ...user, id: user.id! }, { ip: getClientIp(req) });
  if (!claim.ok) {
    return claim.status === 404
      ? NextResponse.json({ error: "Not found" }, { status: 404 })
      : NextResponse.json(
          { error: `${claim.holder?.name ?? "Someone"} is handling this conversation. Take it over to reply.`, holder: claim.holder },
          { status: 409 },
        );
  }
  const convo = await prisma.chatConversation.findUniqueOrThrow({ where: { id } });
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, displayName: true } });
  const staffName = staffChatName(me ?? user);
  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: { conversationId: id, author: ChatAuthor.STAFF, staffUserId: user.id, staffName, body: parsed.data.body },
  });
  // Answered: BF6's clock stops, and an out-of-hours promise has been kept.
  await prisma.chatConversation.update({
    where: { id },
    data: {
      lastMessageAt: now,
      staffSeenAt: now,
      status: ChatStatus.OPEN,
      closedAt: null,
      awaitingSince: null,
      unansweredStage: 0,
      handlerActiveAt: now,
    },
  });
  threadChanged(id, "message");

  let emailed = false;
  const away = !visitorConnected(id) && now.getTime() - convo.visitorSeenAt.getTime() > CHAT_AWAY_MS;
  if (away && convo.visitorEmail) {
    const sent = await sendUsingCatalog({
      key: EMAIL_TEMPLATE_KEYS.CHAT_REPLY,
      to: convo.visitorEmail,
      vars: {
        firstName: convo.visitorName.split(/\s+/)[0] ?? convo.visitorName,
        reply: parsed.data.body,
        staffName,
        link: `${getPublicAppUrl()}${convo.contextPath}`,
      },
      // A chat opened on an atelier, bespoke or consultation page answers as the atelier.
      brand: /^\/(atelier|bespoke|consultation)/.test(convo.contextPath) ? "atelier" : "main",
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
  // She left a phone number only: the house replies by phone or WhatsApp.
  return NextResponse.json({ id: message.id, emailed, phoneOnly: away && !convo.visitorEmail ? convo.visitorPhone : null }, { status: 201 });
}

const patchSchema = z.object({ status: z.nativeEnum(ChatStatus) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const closing = parsed.data.status === ChatStatus.CLOSED;
  const updated = await prisma.chatConversation
    .update({
      where: { id },
      data: {
        status: parsed.data.status,
        closedAt: closing ? new Date() : null,
        // Closed by the house: nothing is waiting, and nobody holds it.
        ...(closing ? { awaitingSince: null, handlerId: null, handlerName: null, handlerActiveAt: null } : {}),
      },
      select: { id: true, status: true },
    })
    .catch(() => null);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  threadChanged(id, "status");
  return NextResponse.json(updated);
}
