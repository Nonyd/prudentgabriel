import { NextRequest, NextResponse } from "next/server";
import { ChatAuthor, ChatStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_WINDOW_MS, accountKey } from "@/lib/auth-limits";
import {
  chatCookieMaxAgeSec,
  chatCookieOptions,
  findChatByToken,
  getChatHoursText,
  isChatOpen,
  issueChatToken,
  openingLine,
  resolveChatContext,
} from "@/lib/chat";
import { CHAT_CLOSED_MESSAGE, CHAT_COOKIE, CHAT_MESSAGE_MAX, type ChatMessageView } from "@/lib/chat-shared";
import { createNotification } from "@/lib/notifications";
import { sendAdminNotificationEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";

const startSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
  /** The page she opened chat on. Path only is kept. */
  path: z.string().max(500).default("/"),
  /** An order reference the page knows (e.g. /track). Kept as context, never verified here. */
  orderRef: z.string().max(60).optional(),
});

function view(m: { id: string; author: ChatAuthor; staffName: string | null; body: string; createdAt: Date }): ChatMessageView {
  return { id: m.id, author: m.author, staffName: m.staffName, body: m.body, createdAt: m.createdAt.toISOString() };
}

function closed() {
  return NextResponse.json({ error: CHAT_CLOSED_MESSAGE }, { status: 403 });
}

/** The visitor's conversation (from her cookie), for the widget's polling. */
export async function GET(req: NextRequest) {
  if (!(await isChatOpen())) return closed();
  const convo = await findChatByToken(req.cookies.get(CHAT_COOKIE)?.value);
  if (!convo) return NextResponse.json({ error: "No conversation" }, { status: 404 });
  await prisma.chatConversation.update({ where: { id: convo.id }, data: { visitorSeenAt: new Date() } });
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json(
    {
      conversation: { contextKind: convo.contextKind, contextLabel: convo.contextLabel, status: convo.status },
      messages: messages.map(view),
      hours: await getChatHoursText(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * BA5: start a conversation. Name and email are required (400 without them);
 * chat must be switched on with a retention period (403 otherwise). On the
 * atelier journey the house's first line hands her the enquiry form.
 */
export async function POST(req: NextRequest) {
  if (!(await isChatOpen())) return closed();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please give your name and email before starting a chat.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  const ip = getClientIp(req);
  const address = await checkRateLimit(`chat-start-address:${ip}`, 20, AUTH_WINDOW_MS);
  const inbox = address.ok ? await checkRateLimit(`chat-start-inbox:${accountKey(email)}`, 5, AUTH_WINDOW_MS) : address;
  if (!inbox.ok) {
    return NextResponse.json(
      { error: "Too many new chats. Please wait a little." },
      { status: 429, headers: { "Retry-After": String(inbox.retryAfterSec) } },
    );
  }

  const session = await auth();
  const context = await resolveChatContext({ path: data.path, orderRef: data.orderRef, userId: session?.user?.id });
  const maxAge = await chatCookieMaxAgeSec();
  const token = issueChatToken(maxAge);
  const appUrl = getPublicAppUrl();
  const startedAt = new Date();

  const convo = await prisma.chatConversation.create({
    data: {
      ...token.data,
      visitorName: data.name,
      visitorEmail: email,
      userId: session?.user?.id ?? null,
      contextKind: context.kind,
      contextPath: context.path,
      contextLabel: context.label,
      productId: context.productId,
      orderRef: context.orderRef,
      status: ChatStatus.OPEN,
      messages: {
        // Explicit times: her message first, then the house's opening line.
        create: [
          { author: ChatAuthor.VISITOR, body: data.message, createdAt: new Date(startedAt.getTime()) },
          { author: ChatAuthor.SYSTEM, body: openingLine(context, appUrl), createdAt: new Date(startedAt.getTime() + 1) },
        ],
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  await createNotification({
    type: "CONTACT_FORM",
    title: context.kind === "ATELIER" ? "New chat — atelier (send the enquiry form)" : "New chat",
    message: `${data.name}${context.label ? ` — ${context.label}` : ""}: ${data.message.slice(0, 120)}`,
    link: `/admin/chat?open=${convo.id}`,
    entityId: convo.id,
  }).catch(() => {});
  await sendAdminNotificationEmail(
    `New chat — ${data.name}`,
    `<p><strong>${data.name.replace(/[<>&]/g, "")}</strong> started a chat${context.label ? ` about ${context.label.replace(/[<>&]/g, "")}` : ""}.</p>
     <p><a href="${appUrl}/admin/chat?open=${convo.id}">Open the chat</a></p>`,
    `chat-start:${convo.id}`,
  ).catch(() => {});

  const res = NextResponse.json(
    {
      conversation: { contextKind: convo.contextKind, contextLabel: convo.contextLabel, status: convo.status },
      messages: convo.messages.map(view),
      hours: await getChatHoursText(),
    },
    { status: 201 },
  );
  res.cookies.set({ ...chatCookieOptions(maxAge), value: token.raw });
  return res;
}
