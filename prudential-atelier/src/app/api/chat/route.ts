import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus, type ChatConversation } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_WINDOW_MS, accountKey } from "@/lib/auth-limits";
import {
  CHAT_MESSAGE_INCLUDE,
  chatCookieMaxAgeSec,
  chatCookieOptions,
  chatMessageView,
  closedLine,
  getChatAvailability,
  getChatHoursText,
  getChatStaffing,
  issueChatToken,
  openingLine,
  resolveChatContext,
  type ChatAvailability,
} from "@/lib/chat";
import { CHAT_CLOSED_MESSAGE, CHAT_MESSAGE_MAX, parseChatContact } from "@/lib/chat-shared";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { notifyChat } from "@/lib/chat-notify";
import { threadChanged } from "@/lib/chat-bus";
import { getPublicAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

const startSchema = z.object({
  /** A guest's name. A signed-in client types nothing (BF4). */
  name: z.string().trim().min(2).max(100).optional(),
  /** BF4: one way to reply — an email or a phone number. */
  contact: z.string().trim().max(200).optional(),
  /** BA5's field; still accepted. */
  email: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
  /** The page she opened chat on. Path only is kept. */
  path: z.string().max(500).default("/"),
  /** An order reference the page knows (e.g. /track). Kept as context, never verified here. */
  orderRef: z.string().max(60).optional(),
});

function closed() {
  return NextResponse.json({ error: CHAT_CLOSED_MESSAGE }, { status: 403 });
}

/** Out of hours (BF2), or open but nobody came (BF6): the panel says so and promises a reply. */
function awayView(c: Pick<ChatConversation, "unansweredStage" | "awaitingSince">, a: ChatAvailability) {
  if (!a.live) return { reason: "hours" as const, opensLabel: a.opensLabel };
  if (c.unansweredStage >= 2 && c.awaitingSince) return { reason: "nobody" as const, opensLabel: null };
  return null;
}

async function threadPayload(convo: ChatConversation, a: ChatAvailability) {
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: convo.id, internal: false },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: CHAT_MESSAGE_INCLUDE,
  });
  return {
    conversation: {
      contextKind: convo.contextKind,
      contextLabel: convo.contextLabel,
      status: convo.status,
      away: awayView(convo, a),
      contact: { email: convo.visitorEmail, phone: convo.visitorPhone },
    },
    messages: messages.map(chatMessageView),
    hours: await getChatHoursText(),
  };
}

/** Her conversation (her cookie, or her account), for the widget. */
export async function GET(req: NextRequest) {
  const a = await getChatAvailability();
  if (!a.enabled) return closed();
  const { conversation } = await resolveChatVisitor(req);
  if (!conversation) return NextResponse.json({ error: "No conversation" }, { status: 404 });
  await prisma.chatConversation.update({ where: { id: conversation.id }, data: { visitorSeenAt: new Date() } });
  return NextResponse.json(await threadPayload(conversation, a), { headers: { "Cache-Control": "private, no-store" } });
}

/** The closed (or nobody-free) line, unless the thread already ends with one. */
async function addAwayLine(conversationId: string, line: string, at: Date) {
  const last = await prisma.chatMessage.findFirst({
    where: { conversationId, internal: false },
    orderBy: { createdAt: "desc" },
    skip: 1, // her message, just written
    select: { author: true, body: true },
  });
  if (last?.author === ChatAuthor.SYSTEM && last.body === line) return;
  await prisma.chatMessage.create({ data: { conversationId, author: ChatAuthor.SYSTEM, body: line, createdAt: new Date(at.getTime() + 1) } });
}

/**
 * Start a conversation, or add to hers. Inside the schedule it is live (201).
 * Outside it (BF2) the message is still taken (202 Accepted): it lands in the
 * inbox like any other, and she is told plainly that the house is closed, when
 * it opens next (computed from the schedule) and that the reply will come by
 * email or phone. A closed widget is a lost lead.
 *
 * BF4: a guest gives her name and one of email or phone (400 without); a
 * signed-in client types nothing.
 */
export async function POST(req: NextRequest) {
  const staffing = await getChatStaffing();
  const now = new Date();
  const a = await getChatAvailability(now, staffing);
  if (!a.enabled) return closed();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please give your name, and an email or phone number, before starting a chat.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const visitor = await resolveChatVisitor(req);

  let name: string;
  let email: string | null;
  let phone: string | null;
  if (visitor.user) {
    name = visitor.user.name?.trim() || visitor.user.email.split("@")[0];
    email = visitor.user.email.toLowerCase();
    phone = null;
  } else {
    const contact = parseChatContact(data.contact ?? data.email);
    if (!data.name || !contact) {
      return NextResponse.json(
        { error: "Please give your name, and an email or phone number, before starting a chat." },
        { status: 400 },
      );
    }
    name = data.name;
    email = contact.email;
    phone = contact.phone;
  }

  const ip = getClientIp(req);
  const address = await checkRateLimit(`chat-start-address:${ip}`, 20, AUTH_WINDOW_MS);
  const inbox = address.ok ? await checkRateLimit(`chat-start-inbox:${accountKey(email ?? phone ?? "")}`, 5, AUTH_WINDOW_MS) : address;
  if (!inbox.ok) {
    return NextResponse.json(
      { error: "Too many new chats. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(inbox.retryAfterSec) } },
    );
  }

  const status = a.live ? 201 : 202;
  const away = a.live
    ? {}
    : { offHoursAt: now, unansweredStage: 2 }; // told now, so BF6 never tells her again

  // She already has a conversation (cookie or account): this is another message in it.
  if (visitor.conversation) {
    const c = visitor.conversation;
    await prisma.chatMessage.create({ data: { conversationId: c.id, author: ChatAuthor.VISITOR, body: data.message, createdAt: now } });
    const updated = await prisma.chatConversation.update({
      where: { id: c.id },
      data: {
        lastMessageAt: now,
        visitorSeenAt: now,
        status: ChatStatus.OPEN,
        closedAt: null,
        awaitingSince: c.awaitingSince ?? now,
        // A fresh wait inside the schedule starts BF6's clock again; one out of hours is told at once.
        ...(a.live ? (c.awaitingSince ? {} : { unansweredStage: 0, offHoursAt: null }) : away),
      },
    });
    if (!a.live) await addAwayLine(c.id, closedLine(a.opensLabel, { email: c.visitorEmail, phone: c.visitorPhone }), now);
    threadChanged(c.id, "message");
    return NextResponse.json(await threadPayload(updated, a), { status });
  }

  const context = await resolveChatContext({ path: data.path, orderRef: data.orderRef, userId: visitor.user?.id });
  const maxAge = await chatCookieMaxAgeSec();
  const token = issueChatToken(maxAge);
  const appUrl = getPublicAppUrl();
  const houseLine = a.live ? openingLine(context, appUrl) : closedLine(a.opensLabel, { email, phone });

  const convo = await prisma.chatConversation.create({
    data: {
      ...token.data,
      visitorName: name,
      visitorEmail: email,
      visitorPhone: phone,
      userId: visitor.user?.id ?? null,
      contextKind: context.kind,
      contextPath: context.path,
      contextLabel: context.label,
      productId: context.productId,
      orderRef: context.orderRef,
      status: ChatStatus.OPEN,
      awaitingSince: now,
      ...away,
      messages: {
        // Explicit times: her message first, then the house's line.
        create: [
          { author: ChatAuthor.VISITOR, body: data.message, createdAt: new Date(now.getTime()) },
          { author: ChatAuthor.SYSTEM, body: houseLine, createdAt: new Date(now.getTime() + 1) },
          // The atelier hand-off still applies out of hours.
          ...(!a.live && context.kind === "ATELIER"
            ? [{ author: ChatAuthor.SYSTEM, body: openingLine(context, appUrl), createdAt: new Date(now.getTime() + 2) }]
            : []),
        ],
      },
    },
  });

  // BF9: a new conversation tells everyone named (or BA5's desk until someone is named).
  await notifyChat({
    conversationId: convo.id,
    reason: "new",
    staffing,
    title: `${a.live ? "New chat" : "New chat (out of hours)"}${context.kind === "ATELIER" ? " — atelier (send the enquiry form)" : ""} — ${name}`,
    message: `${name}${context.label ? ` — ${context.label}` : ""}: ${data.message.slice(0, 160)}`,
  });
  threadChanged(convo.id, "message");

  const res = NextResponse.json(await threadPayload(convo, a), { status });
  res.cookies.set({ ...chatCookieOptions(maxAge), value: token.raw });
  return res;
}
