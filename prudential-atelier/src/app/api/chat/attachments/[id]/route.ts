import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveChatVisitor } from "@/lib/chat-visitor";
import { serveChatAttachment } from "@/lib/chat-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BF7: a file in her own conversation, for her — through her cookie or her
 * account, never by a guessable public path. Anyone else: 404, the same answer
 * as a file that does not exist.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { conversation, user } = await resolveChatVisitor(req);
  const att = await prisma.chatAttachment.findUnique({
    where: { id },
    select: { storageKey: true, mime: true, originalName: true, conversationId: true, conversation: { select: { userId: true } } },
  });
  const hers = att && (att.conversationId === conversation?.id || (user && att.conversation.userId === user.id));
  if (!att || !hers) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return serveChatAttachment(att);
}
