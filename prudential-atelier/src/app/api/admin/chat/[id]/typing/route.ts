import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { staffChatName } from "@/lib/chat";
import { touchClaim } from "@/lib/chat-claim";
import { TYPING_TTL_MS, publishToConversation } from "@/lib/chat-bus";

const names = new Map<string, string>();

/**
 * BF1: someone from the house is typing — shown to her ("Jubilee is typing")
 * and to any other admin in the thread. A signal with a time-to-live; nothing
 * is stored. It also tells BF5 the holder is still here.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("chat");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const userId = gate.session.user.id!;
  const typing = (await req.json().catch(() => null))?.typing !== false;
  let name = names.get(userId);
  if (!name) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, displayName: true } });
    name = staffChatName(u ?? gate.session.user);
    names.set(userId, name);
    if (names.size > 500) names.clear();
  }
  publishToConversation(id, { type: "typing", who: "staff", name, ttlMs: typing ? TYPING_TTL_MS : 0 });
  if (typing) await touchClaim(id, userId);
  return new NextResponse(null, { status: 204 });
}
