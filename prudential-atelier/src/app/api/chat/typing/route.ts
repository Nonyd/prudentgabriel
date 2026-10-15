import { NextRequest, NextResponse } from "next/server";
import { isChatOpen } from "@/lib/chat";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { TYPING_TTL_MS, publishToConversation } from "@/lib/chat-bus";

const lastPing = new Map<string, number>();

/**
 * BF1: she is typing. A signal to the house's open thread, gone on its own
 * after a few seconds of silence. Nothing is written anywhere — not the
 * conversation, not a log — so it can never enter the transcript.
 */
export async function POST(req: NextRequest) {
  if (!(await isChatOpen())) return new NextResponse(null, { status: 204 });
  const { conversation } = await resolveChatVisitor(req);
  if (!conversation) return NextResponse.json({ error: "No conversation" }, { status: 404 });
  const typing = (await req.json().catch(() => null))?.typing !== false;
  const now = Date.now();
  // At most one signal a second per conversation, whatever the client sends.
  if (typing && now - (lastPing.get(conversation.id) ?? 0) < 1000) return new NextResponse(null, { status: 204 });
  lastPing.set(conversation.id, now);
  if (lastPing.size > 5000) lastPing.clear();
  publishToConversation(conversation.id, { type: "typing", who: "visitor", name: null, ttlMs: typing ? TYPING_TTL_MS : 0 }, "staff");
  return new NextResponse(null, { status: 204 });
}
