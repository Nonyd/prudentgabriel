import { NextRequest, NextResponse } from "next/server";
import { ChatStatus, type Prisma } from "@prisma/client";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const CHAT_PAGE_SIZE = 50;

/**
 * BA5 chat inbox — the same desk as contact messages (any general admin).
 *
 * Conversations are kept indefinitely, so the list must survive years:
 * - no search: OPEN conversations only, newest activity first, 50 a page;
 * - ?status=CLOSED: the closed archive, same paging;
 * - ?q=: search open AND closed by name, email, order reference or piece.
 */
export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Math.min(10_000, Number(sp.get("page")) || 1));
  const status = sp.get("status") === "CLOSED" ? ChatStatus.CLOSED : ChatStatus.OPEN;

  const where: Prisma.ChatConversationWhereInput = q
    ? {
        OR: [
          { visitorName: { contains: q, mode: "insensitive" } },
          { visitorEmail: { contains: q, mode: "insensitive" } },
          { orderRef: { contains: q, mode: "insensitive" } },
          { contextLabel: { contains: q, mode: "insensitive" } },
        ],
      }
    : { status };

  const rows = await prisma.chatConversation.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * CHAT_PAGE_SIZE,
    take: CHAT_PAGE_SIZE + 1,
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      contextKind: true,
      contextLabel: true,
      contextPath: true,
      orderRef: true,
      status: true,
      lastMessageAt: true,
      staffSeenAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { author: true, body: true, createdAt: true } },
    },
  });
  const hasMore = rows.length > CHAT_PAGE_SIZE;
  const items = rows.slice(0, CHAT_PAGE_SIZE).map(({ messages, ...c }) => ({
    ...c,
    last: messages[0] ?? null,
    unread: messages[0]?.author === "VISITOR" && (!c.staffSeenAt || c.staffSeenAt < messages[0].createdAt),
  }));
  return NextResponse.json({ items, page, hasMore });
}
