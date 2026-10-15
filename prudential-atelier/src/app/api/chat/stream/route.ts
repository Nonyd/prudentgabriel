import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isChatOpen } from "@/lib/chat";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { subscribeConversation } from "@/lib/chat-bus";
import { sseResponse } from "@/lib/http/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BF1: her live line — new messages, edits, files, the house typing, someone
 * joining, the conversation closing or reopening. Server to client only; what
 * she sends stays an ordinary POST. If this cannot be opened the widget goes
 * back to polling GET /api/chat and still works.
 */
export async function GET(req: NextRequest) {
  if (!(await isChatOpen())) return NextResponse.json({ error: "Chat is not open" }, { status: 403 });
  const { conversation } = await resolveChatVisitor(req);
  if (!conversation) return NextResponse.json({ error: "No conversation" }, { status: 404 });
  const id = conversation.id;
  let beats = 0;
  return sseResponse(
    req,
    (send) => subscribeConversation(id, "visitor", (e) => send(e.type, e)),
    {
      // Her panel is open: replies are not emailed while she is here (BA5's away rule).
      onHeartbeat: async () => {
        if (++beats % 3 !== 0) return;
        await prisma.chatConversation.update({ where: { id }, data: { visitorSeenAt: new Date() } }).catch(() => {});
      },
    },
  );
}
