import type { NextRequest } from "next/server";
import type { ChatConversation } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findChatByToken } from "@/lib/chat";
import { CHAT_COOKIE } from "@/lib/chat-shared";
import { provenEmail } from "@/lib/email-verification";

export type ChatVisitor = {
  conversation: ChatConversation | null;
  /** Signed in as a client (or anyone): the thread belongs to her account. */
  user: { id: string; name: string | null; email: string } | null;
};

/**
 * BF4: guest threads started under her email join her account when she signs
 * in with that email, so the house sees one history rather than two halves.
 */
export async function mergeGuestChats(userId: string, email: string): Promise<number> {
  const { count } = await prisma.chatConversation.updateMany({
    where: { userId: null, visitorEmail: { equals: email.trim().toLowerCase(), mode: "insensitive" } },
    data: { userId },
  });
  return count;
}

/**
 * The conversation this browser may see. Signed in: her account's latest
 * thread — the same one on the storefront and her dashboard — after merging
 * guest threads under her email. A cookie thread counts only if it is hers.
 * Otherwise: the thread her cookie opens.
 */
export async function resolveChatVisitor(req: NextRequest): Promise<ChatVisitor> {
  const session = await auth();
  const cookieConvo = await findChatByToken(req.cookies.get(CHAT_COOKIE)?.value);
  const id = session?.user?.id;
  const email = session?.user?.email;
  // An admin "viewing as" a client never writes into her chat.
  if (!id || !email || session.user.viewAs) return { conversation: id ? null : cookieConvo, user: null };

  // Threads left under her email join her account only once she has proven the address.
  const proven = await provenEmail(id);
  if (proven) await mergeGuestChats(id, proven);
  const user = { id, name: session.user.name ?? null, email };
  if (cookieConvo && (cookieConvo.userId === id || (proven && cookieConvo.visitorEmail?.toLowerCase() === proven))) {
    const mine =
      cookieConvo.userId === id
        ? cookieConvo
        : await prisma.chatConversation.update({ where: { id: cookieConvo.id }, data: { userId: id } });
    return { conversation: mine, user };
  }
  const latest = await prisma.chatConversation.findFirst({
    where: { userId: id },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
  });
  return { conversation: latest, user };
}
