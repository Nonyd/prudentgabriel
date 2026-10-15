import { NextRequest, NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { serveChatAttachment } from "@/lib/chat-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BF7: an admin opening a stranger's file — the normal case — through the chat
 * gate. Served so it cannot run: its stored type, nosniff, a sandboxing CSP,
 * and only images shown inline (a PDF downloads).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { attachmentId } = await params;
  const att = await prisma.chatAttachment.findUnique({
    where: { id: attachmentId },
    select: { storageKey: true, mime: true, originalName: true },
  });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return serveChatAttachment(att);
}
