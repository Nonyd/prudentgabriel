import { NextRequest } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { subscribeConversation, subscribeInbox, visitorConnected } from "@/lib/chat-bus";
import { sseResponse } from "@/lib/http/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BF1: the house's live line — one connection for the open conversation
 * (`?c=`), carrying the inbox's changes too. If it cannot be opened the inbox
 * falls back to polling.
 */
export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const c = req.nextUrl.searchParams.get("c");
  const conversationId = c && (await prisma.chatConversation.findUnique({ where: { id: c }, select: { id: true } }))?.id;
  return sseResponse(req, (send) => {
    const off = [subscribeInbox((e) => send(e.type, e))];
    if (conversationId) {
      off.push(subscribeConversation(conversationId, "staff", (e) => send(e.type, e)));
      send("presence", { type: "presence", visitorOnline: visitorConnected(conversationId) });
    }
    return () => off.forEach((f) => f());
  });
}
