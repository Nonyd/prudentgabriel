import { NextRequest, NextResponse } from "next/server";
import { ChatStatus } from "@prisma/client";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** BA5: the chat inbox — same desk as contact messages until the house names who answers. */
export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const status = new URL(req.url).searchParams.get("status") === "CLOSED" ? ChatStatus.CLOSED : ChatStatus.OPEN;
  const rows = await prisma.chatConversation.findMany({
    where: { status },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
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
  const items = rows.map(({ messages, ...c }) => ({
    ...c,
    last: messages[0] ?? null,
    unread: messages[0]?.author === "VISITOR" && (!c.staffSeenAt || c.staffSeenAt < messages[0].createdAt),
  }));
  return NextResponse.json({ items });
}
